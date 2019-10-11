from minargon import app
from flask import jsonify, Response, request, abort
from redis import Redis
import redis.exceptions
import json
from minargon.tools import parseiso, parseiso_or_int, stream_args
from functools import wraps

import redis_api

# error class for connecting to redis
class RedisConnectionError:
    def __init__(self, front_end_abort):
        self.err = None
        self.msg = "Unknown Error"
        self.name = "Unknown"
        self.front_end_abort = front_end_abort

    def register_redis_error(self, err, name):
        self.err = err
        self.msg = str(err)
        self.name = name
        return self

    def register_notfound_error(self, name):
        self.name = name
        self.msg = "Database (%s) not found" % name
        return self

    def message(self):
        return self.msg

    def database_name(self):
        return self.name

# get the config to connect to redis databases
redis_instances = app.config["REDIS_INSTANCES"]
r_databases = {}
for database_name, config in redis_instances.items():
    this_redis = Redis(**config)
    r_databases[database_name] = this_redis

# decorator for getting the correct database from the provided link
def redis_route(func):
    @wraps(func)
    def wrapper(rconnect, *args, **kwargs):
        front_end_abort = kwargs.pop("front_end_abort", False)
        if rconnect in r_databases:
            r = r_databases[rconnect]
            # try to make a connection
            try:
                return func(r, *args, **kwargs)
            except (redis.exceptions.ConnectionError, redis.exceptions.BusyLoadingError, redis.exceptions.ResponseError, redis_api.MalformedRedisEntry) as err:
                error = RedisConnectionError(front_end_abort).register_redis_error(err, rconnect)
                return abort(503, error)
        else:
            return abort(404, RedisConnectionError(front_end_abort).register_notfound_error(rconnect))
        
    return wrapper
"""
	Routes for getting stuff from Redis
"""

@app.route('/<rconnect>/test_redis')
@redis_route
def test_redis(rconnect):
    try:
	x = rconnect.ping()
    except Exception, err:
        import sys
        sys.stderr.write('ERROR: %s' % str(err))
        raise Exception("Redis cannot get foo")
    return str(x)

# get a datum stored in a snapshot
@app.route('/<rconnect>/snapshot/<data>')
@redis_route
def snapshot(rconnect, data):
    redis_key = "snapshot:%s" % data
    # args should be key-value pairs of specifiers in the redis keys
    # e.g. /snapshot/waveform?wire=1
    # decodes to the redis key snapshot:waveform:wire:1
    for (k, v) in request.args.iteritems():
        redis_key += ":%s:%s" % (k, v)
    return jsonify(values=redis_api.get_key(rconnect, redis_key))

@app.route('/<rconnect>/waveform/<data>')
@redis_route
def waveform(rconnect, data):
    redis_key = "snapshot:%s" % data
    # args should be key-value pairs of specifiers in the redis keys
    # e.g. /waveform/sparse_waveform?wire=1
    # decodes to the redis key snapshot:sparse_waveform:wire:1
    for (k, v) in request.args.iteritems():
        redis_key += ":%s:%s" % (k, v)
    data, offsets, period = redis_api.get_waveform(rconnect, redis_key)
    return jsonify(data=data, offsets=offsets, period=period)

def get_min_end_time(data):
    min_end_time = 0
    for _, val in data.items():
        if len(val) == 0:
            continue
        this_end_time = val[-1][0]
        if min_end_time == 0 or this_end_time < min_end_time:
            min_end_time = this_end_time
    return min_end_time


def front_end_key_api(data):
    ret = {}
    # transform internal key representation into representation for front end
    for key, series in data.items():
        info = key.split(":")
        metric = info[2]
        instance = info[1]
        if metric not in ret:
            ret[metric] = {}
        ret[metric][instance] = series

    return ret

def build_key(group, metric, instance, stream):
    return group + ":" + instance + ":" + metric + ":" + stream

# get data from a stream
@app.route('/<rconnect>/stream/<name>')
@redis_route
def stream(rconnect, name):
    args = stream_args(request.args)
    data = redis_api.get_streams(rconnect, [name], **args)
    min_end_time = get_min_end_time(data)

    return jsonify(values=data,min_end_time=min_end_time)

# get data and subscribe to a stream
@app.route('/<rconnect>/stream_subscribe/<name>')
@redis_route
def stream_subscribe(rconnect, name):
    args = stream_args(request.args)
    def event_stream():
        for data in redis_api.subscribe_streams(rconnect, [name], **args):
            min_end_time = get_min_end_time(data)
            ret = {}
            ret["values"] = data
            ret["min_end_time"] = min_end_time
            ret = "data: %s\n\n" % json.dumps(ret)
            yield ret 
    # sometiems this won't work if the client disconnects from the stream un-gracefully
    # TODO: how to detect?
    return Response(event_stream(), mimetype="text/event-stream")

# get a simple key
@app.route("/<rconnect>/key/<keyname>")
@redis_route
def key(rconnect, keyname):
    return jsonify(value=redis_api.get_key(rconnect, keyname))

@app.route('/<rconnect>/stream_group_subscribe/<stream_type>/<list:metric_names>/<group_name>/<int:instance_start>/<int:instance_end>')
@app.route('/<rconnect>/stream_group_subscribe/<stream_type>/<list:metric_names>/<group_name>/<list:instance_list>')
@redis_route
def stream_group_subscribe(rconnect, stream_type, metric_names, group_name, instance_start=None, instance_end=None, instance_list=None):
    args = stream_args(request.args)

    if instance_list is not None:
        instances = instance_list
    else: 
        instances = [str(x) for x in range(instance_start, instance_end)]

    stream_names = []
    for metric in metric_names:
        for inst in instances:
            this_stream_name = "%s:%s:%s:%s" % (group_name, inst, metric, stream_type)
            stream_names.append( this_stream_name )

    def event_stream():
        for data in redis_api.subscribe_streams(rconnect, stream_names, **args):
            min_end_time = get_min_end_time(data)
            values = front_end_key_api(data)
            ret = {}
            ret["values"] = values
            ret["min_end_time"] = min_end_time
            ret = "data: %s\n\n" % json.dumps(ret)
            yield ret 

    # sometiems this won't work if the client disconnects from the stream un-gracefully
    # TODO: how to detect?
    return Response(event_stream(), mimetype="text/event-stream")

@app.route('/<rconnect>/stream_group/<stream_type>/<list:metric_names>/<group_name>/<int:instance_start>/<int:instance_end>')
@app.route('/<rconnect>/stream_group/<stream_type>/<list:metric_names>/<group_name>/<list:instance_list>')
@redis_route
def stream_group(rconnect, stream_type, metric_names, group_name, instance_start=None, instance_end=None, instance_list=None):
    args = stream_args(request.args)

    if instance_list is not None:
        instances = instance_list
    else: 
        instances = [str(x) for x in range(instance_start, instance_end)]

    stream_names = []
    for metric in metric_names:
        for inst in instances:
            this_stream_name = "%s:%s:%s:%s" % (group_name, inst, metric, stream_type)
            stream_names.append( this_stream_name )

    data = redis_api.get_streams(rconnect, stream_names, **args)

    # get the least most updated stream for the front end
    min_end_time = get_min_end_time(data)

    values = front_end_key_api(data)

    return jsonify(values=values, min_end_time=min_end_time)

@app.route('/<rconnect>/infer_step_size/<stream_type>/<metric_name>/<group_name>/<instance_name>')
@app.route('/<rconnect>/infer_step_size/<stream_name>')
@redis_route
def infer_step_size(rconnect, stream_name=None, stream_type=None, metric_name=None, group_name=None, instance_name=None):
    if stream_name is None:
        key = "%s:%s:%s:%s" % (group_name, instance_name, metric_name, stream_type)
    else: 
        key = stream_name
    data = redis_api.get_last_streams(rconnect, [key], count=3)
    times = [t for t, _ in data[key]] 
    
    if len(times) < 2:
        avg_delta_times = 0
    else:
        sum_delta_times = 0
        n_differences = 0
        for i in range(len(times) - 1):
            # HOTFIX -- TODO: make better
            this_difference = int(times[i]) - int(times[i+1])
            if this_difference < 10: 
              continue

            n_differences += 1
            sum_delta_times += int(times[i]) - int(times[i+1])
        if n_differences > 0:
            avg_delta_times = sum_delta_times / (len(times) - 1)
        else:
            avg_delta_times = 0
    return jsonify(step=avg_delta_times)


@redis_route
def build_link_tree(rconnect):
    groups = rconnect.smembers("GROUPS")
    pipeline = rconnect.pipeline()
    for group in groups:
       pipeline.get("GROUP_CONFIG:%s" % group)
       pipeline.lrange("GROUP_MEMBERS:%s" % group, 0, -1)
    result = pipeline.execute()

    configs = []
    members = []
    for i in range(0, len(result), 2):
        configs.append( result[i])
        members.append( result[i+1])

    # build the dictionary for the tree
    tree_dict = {}
    tree_dict["text"] = "Online Metrics"
    tree_dict["expanded"] = True
    tree_dict["displayCheckbox"] = False
    tree_dict["nodes"] = []
    
    # index by group, the metric, then instance
    for group, config, this_members, in zip(groups, configs, members):
        config = json.loads(config)
        tree_dict["nodes"].append({
            "expanded": False,
            "text": group,
            "href": "#parent1",
            "displayCheckbox": False,
            "nodes" : []
        })
        for metric,_ in config["metric_config"].items():
            tree_dict["nodes"][-1]["nodes"].append({
              "expanded": False,
              "displayCheckbox": False,
              "text": metric,
              "href": "#parent2",
              "nodes": []
            })
            for stream in config["streams"]:
                tree_dict["nodes"][-1]["nodes"][-1]["nodes"].append({
                  "displayCheckbox": False,
                  "expanded": False,
                  "text": stream,
                  "href": "#parent2",
                  "nodes": []
                })
                for m in this_members:
                    tree_dict["nodes"][-1]["nodes"][-1]["nodes"][-1]["nodes"].append({
			"expanded": False,
			"text": m,
			"href": "#parent3",
			"database": "online",
			"database_type": "redis",
			"ID": build_key(group, metric, m,stream), 
                    })
    return tree_dict
    

@redis_route
def get_group_config(rconnect, group_name):
    # default ret
    default = {
      "group": group_name,
      "instances": [],
      "metric_list": [],
      "metric_config": {},
      "streams": [],
      "stream_links": [],
    }
    redis_database = "online"

    # setup pipeline
    pipeline = rconnect.pipeline()
    # pull down the config and decode it
    pipeline.get("GROUP_CONFIG:%s" % group_name)
    # pull down the group members
    pipeline.lrange("GROUP_MEMBERS:%s" % group_name, 0, -1)

    # run the pipeline and get the results
    result = pipeline.execute()
    config = result[0]
    instances = result[1]
  
    if config is None or instances is None:
        return default
    config = json.loads(config)

    # set up the stream links
    config["stream_links"] = [redis_database for s in config["streams"]]
    # setup the instances
    config["instances"] = list(instances)
    # setup the metric list
    config["metric_list"] = config["metric_config"].keys()
    # set the group name
    config["group"] = group_name

    return config
