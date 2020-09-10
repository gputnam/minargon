from minargon import app
from flask import jsonify, Response, request, abort
from redis import Redis
import redis.exceptions
import json
from minargon.tools import parseiso, parseiso_or_int, stream_args
from functools import wraps
from datetime import datetime, timedelta # needed for testing only
import calendar
from pytz import timezone

import redis_api
import postgres_api
from psycopg2.extras import RealDictCursor
from minargon.hardwaredb import hardwaredb_route, select

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

@app.route('/<rconnect>/ping_redis')
@redis_route
def ping_redis(rconnect):
    return jsonify(data=rconnect.ping())

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
    ret = jsonify(data=data, offsets=offsets, period=period)
    return ret

@app.route('/<rconnect>/waveform_binary/<data>')
@redis_route
def waveform_binary(rconnect, data):
    redis_key = "snapshot:%s" % data
    # args should be key-value pairs of specifiers in the redis keys
    # e.g. /waveform/sparse_waveform?wire=1
    # decodes to the redis key snapshot:sparse_waveform:wire:1
    for (k, v) in request.args.iteritems():
        redis_key += ":%s:%s" % (k, v)
    data = redis_api.get_waveform_binary(rconnect, redis_key)
    return Response(data, mimetype="application/octet-stream")

@app.route('/<rconnect>/hget/<name>/<list:keys>')
@redis_route
def hget(rconnect, name, keys):
    pipeline = rconnect.pipeline()
    for key in keys:
        pipeline.hget(name, key)
    return jsonify(**dict([(key,val) for key,val in zip(keys, pipeline.execute())]))

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

def build_key(group, metric, instance, stream, join=":"):
    return group + join + instance + join + metric + join + stream

# get data from a stream
@app.route('/<rconnect>/stream/<name>')
@redis_route
def stream(rconnect, name):
    args = stream_args(request.args)
    data = redis_api.get_streams(rconnect, [name], **args)
    min_end_time = get_min_end_time(data)

    return jsonify(values=data,min_end_time=min_end_time)

@app.route('/<rconnect>/alarms')
@redis_route
def alarms(rconnect):
    values = list(reversed(sorted(redis_api.fetch_alarms(rconnect).items(), key=lambda d: d[1]["time"])))
    return jsonify(values=values)

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

@app.route('/<connect>/stream_group/<stream_type>/<list:metric_names>/<group_name>/<int:instance_start>/<int:instance_end>')
@app.route('/<connect>/stream_group/<stream_type>/<list:metric_names>/<group_name>/<list:instance_list>')
@app.route('/<connect>/stream_group/<stream_type>/<list:metric_names>/<group_name>/hw_select/<hw_selector:hw_select>')
@hardwaredb_route
def stream_group(connect, stream_type, metric_names, group_name, instance_start=None, instance_end=None, instance_list=None, hw_select=None):
    args = stream_args(request.args)

    if instance_list is not None:
        instances = instance_list
    elif instance_start is not None and instance_end is not None: 
        instances = [str(x) for x in range(instance_start, instance_end)]
    elif hw_select is not None:
        instances = [str(x) for x in select(hw_select)]

    if stream_type == "archived":
        values = stream_group_archived(connect, stream_type, metric_names, group_name, instances, args)
        return jsonify(values=values)
    else:
        values, min_end_time = stream_group_online(connect, stream_type, metric_names, group_name, instances, args)
        return jsonify(values=values, min_end_time=min_end_time)

@app.route('/<connect>/stream_group_hw_step/<stream_type>/<metric_name>/<group_name>/<hw_selector:hw_select>')
@hardwaredb_route
def stream_group_hw_step(connect, stream_type, metric_name, group_name, hw_select):
    args = stream_args(request.args)
    # get an instance
    instance = select(hw_select)[0]
    # build a key
    key = "%s:%s:%s:%s" % (group_name, instance, metric_name, stream_type)
    # get the step
    return infer_step_size_online(connect, key)


def average_streams(streams):
    return streams[0]

@app.route('/<rconnect>/stream_avg/<list:streams>')
@redis_route
def stream_avg(rconnect, streams):
    args = stream_args(request.args)

    data = redis_api.avg_streams(rconnect, [streams], **args)

    # get the least most updated stream for the front end
    min_end_time = get_min_end_time(data)

    return jsonify(values=data, min_end_time=min_end_time)

@app.route('/<connect>/stream_group_hw_avg/<stream_type>/<metric_name>/<group_name>/<hw_selector_list:hw_selects>')
@app.route('/<connect>/stream_group_hw_avg/<stream_type>/<metric_name>/<group_name>/<hw_selector_list:hw_selects>/<int:downsample>')
@hardwaredb_route
def stream_group_hw_avg(connect, stream_type, metric_name, group_name, hw_selects, downsample=1):
    args = stream_args(request.args)

    # downsample must be positive
    if downsample < 1:
        downsample = 1

    # build the instances
    channels = [[str(x) for i,x in enumerate(select(hw_select)) if i % downsample == 0] for hw_select in hw_selects]
 
    values, min_end_time = stream_group_online_avg(connect, stream_type, metric_name, group_name, channels, args)

    ret = {}
    ret[metric_name] = {}
    # average over each HW grouping
    for hw_channels, hw_select in zip(channels, hw_selects):
         ret[metric_name][hw_select.to_url()] = values[metric_name][hw_channels[0]]

    return jsonify(values=ret, min_end_time=min_end_time)

@postgres_api.postgres_route
def infer_step_size_archived(connection, stream_type, metric_names, group_name, instance):
    connection, config = connection

    # first figure out if any of the provided metrics are being archived
    cursor = connection.cursor(cursor_factory=RealDictCursor)
    query = "SELECT POSTGRES_TABLE from RUNCON_PRD.MONITOR_MAP where CHANNEL_ID = {INSTANCE} AND GROUP_NAME = '{GROUP_NAME}' "\
            "AND METRIC = '{METRIC_NAME}'"
    for metric in metric_names:
        query_builder = {
          "INSTANCE": instance,
          "METRIC_NAME": metric,
          "GROUP_NAME": group_name
        }
        q = query.format(**query_builder)
        try:
            cursor.execute(q)
        except:
            cursor.execute("ROLLBACK")
            connection.commit()
            raise

        data = cursor.fetchall()
        if len(data) > 0:
            metric_name = metric
            break
 
    # no table exists -- just return step of 0
    else:
        return jsonify(step=0)

    start = datetime.now(timezone('UTC')) - timedelta(days=100)  # Start time
    start = calendar.timegm(start.timetuple()) *1e3 + start.microsecond/1e3 # convert to unix ms
    stop = datetime.now(timezone('UTC'))
    stop = calendar.timegm(stop.timetuple()) *1e3 + stop.microsecond/1e3 # convert to unix ms

    cursor = connection.cursor(cursor_factory=RealDictCursor)

    query = postgres_api.postgres_querymaker([instance], start, stop, config, name=group_name, metric=metric_name, avg="mean")
    try:
        cursor.execute(query)
    except:
        cursor.execute("ROLLBACK")
        connection.commit()
        raise

    data = cursor.fetchall()
    # Get the sample size from last two values in query
    step_size = None
    if len(data) >= 2:
        step_size = data[len(data) - 1]['sample_time'] - data[len(data) - 2]['sample_time'] 

    # Catch for if no step size exists
    if step_size == None:
        step_size = 1e3

    return jsonify(step=step_size)

@postgres_api.postgres_route
def stream_group_archived(connection, stream_type, metric_names, group_name, instances, args):
    connection, config = connection
    args = stream_args(request.args)

    # first check if the table exists
    cursor = connection.cursor(cursor_factory=RealDictCursor)

    existing_metrics = []
    for metric in metric_names:
        query = "SELECT POSTGRES_TABLE from RUNCON_PRD.MONITOR_MAP where CHANNEL_ID = {INSTANCE} AND GROUP_NAME = '{GROUP_NAME}' "\
                "AND METRIC = '{METRIC_NAME}'"
        query_builder = {
          "INSTANCE": instances[0],
          "METRIC_NAME": metric,
          "GROUP_NAME": group_name
        }
        q = query.format(**query_builder)
        try:
            cursor.execute(q)
        except:
            cursor.execute("ROLLBACK")
            connection.commit()
            raise
        table_data = cursor.fetchall()
        if len(table_data) > 0:
            existing_metrics.append(metric)
    metric_names = existing_metrics

    start = args["start"]
    stop = args["stop"]
    if start is None:
        start = datetime.now(timezone('UTC')) - timedelta(days=100)  # Start time
        start = calendar.timegm(start.timetuple()) *1e3 + start.microsecond/1e3 # convert to unix ms
    if stop is None:
        stop = datetime.now(timezone('UTC'))
        stop = calendar.timegm(stop.timetuple()) *1e3 + stop.microsecond/1e3 # convert to unix ms

    ret = {}
    for metric in metric_names:
        ret[metric] = {}
        for inst in instances:
            ret[metric][inst] = []

    # build the query
    query = ";".join([postgres_api.postgres_querymaker(instances, start, stop, config, name=group_name, metric=metric, avg="mean") for metric in metric_names])
    if len(query) > 0:
        try:
            cursor.execute(query)
        except:
            cursor.execute("ROLLBACK")
            connection.commit()
            raise

        data = cursor.fetchall()
    else:
        data = []

    for line in data:
        ID = str(line["id"])
        val = line["val0"]
        time = line["sample_time"]
        ret[metric_names[0]][ID].append((time, val))

    #for line in data:
    #    ret[metric][instance].appen

    return ret

@redis_route
def stream_group_online_avg(rconnect, stream_type, metric, group_name, instance_lists, args):
    args = stream_args(request.args)

    stream_names = []
    for instances in instance_lists:
        this_stream_list = []
        for inst in instances:
            this_stream_name = "%s:%s:%s:%s" % (group_name, inst, metric, stream_type)
            this_stream_list.append( this_stream_name )
        stream_names.append(this_stream_list)

    data = redis_api.avg_streams(rconnect, stream_names, **args)

    # get the least most updated stream for the front end
    min_end_time = get_min_end_time(data)

    values = front_end_key_api(data)

    return values, min_end_time

@redis_route
def stream_group_online(rconnect, stream_type, metric_names, group_name, instances, args):
    args = stream_args(request.args)

    stream_names = []
    for metric in metric_names:
        for inst in instances:
            this_stream_name = "%s:%s:%s:%s" % (group_name, inst, metric, stream_type)
            stream_names.append( this_stream_name )

    data = redis_api.get_streams(rconnect, stream_names, **args)

    # get the least most updated stream for the front end
    min_end_time = get_min_end_time(data)

    values = front_end_key_api(data)

    return values, min_end_time

@app.route('/<connect>/infer_step_size/<stream_type>/<list:metric_names>/<group_name>/<instance_name>')
@app.route('/<connect>/infer_step_size/<stream_name>')
def infer_step_size(connect, stream_name=None, stream_type=None, metric_names=None, group_name=None, instance_name=None):
    if stream_type == "archived":
        return infer_step_size_archived(connect, stream_type, metric_names, group_name, instance_name)
    else:
        if stream_name is None:
            key = "%s:%s:%s:%s" % (group_name, instance_name, metric_names[0], stream_type)
        else: 
            key = stream_name
        return infer_step_size_online(connect, key)

@redis_route
def infer_step_size_online(rconnect, key):
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
def get_configs(rconnect, keys): 
    ret = []
    for k in keys:
        ret.append({
          "file": k.replace(":", " "),
          "text": k.split(":")[-1],
          "database": "online",
          "database_type": "redis",
          "ID": k
        })

    return ret

@redis_route
def build_link_list(rconnect):
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

    ret = []

    # index by group, the metric, then instance
    for group, config, this_members, in zip(groups, configs, members):
        config = json.loads(config)
	if "metric_config" not in config: continue
        metrics = config["metric_config"].keys()
        streams = config["streams"]
        ret.append({
            "multiply": [[group], this_members, metrics, streams],
	    "database": "online",
	    "database_type": "redis",
            "file_join": " ",
            "ID_join": ":"
        })
    return ret

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
	if "metric_config" not in config: continue

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

    # add the archiving database
    if "archiving" in config["streams"]:
        config["streams"].append("archived")
        config["stream_links"].append("metric_archiving")

    return config
