from . import app
from flask import jsonify, Response, request
from redis import Redis
import json
from tools import parseiso, parseiso_or_int

import redis_api

redis = Redis(host=app.config["REDIS_HOST"], port=int(app.config["REDIS_PORT"]))
PROGRAMS = []

"""
	Routes for getting stuff from Redis
"""

@app.route('/online/test_redis')
def test_redis():
    try:
        x = redis.get("foo")
    except Exception, err:
        sys.stderr.write('ERROR: %sn' % str(err))
        raise Exception("Redis cannot get foo")
    return str(x)

# get a datum stored in a snapshot
@app.route('/online/snapshot/<data>')
def snapshot(data):
    redis_key = "snapshot:%s" % data
    # args should be key-value pairs of specifiers in the redis keys
    # e.g. /snapshot/waveform?wire=1
    # decodes to the redis key snapshot:waveform:wire:1
    for (k, v) in request.args.iteritems():
        redis_key += ":%s:%s" % (k, v)
    return jsonify(values=redis_api.get_key(redis, redis_key))

def stream_args(args):
    ret = {}
    ret["start"] = args.get('start',None,type=parseiso_or_int)
    ret["stop"] = args.get('stop', None,type=parseiso_or_int)
    ret["n_data"] = args.get('n_data', None, type=int)

    return ret

# get data from a stream
@app.route('/online/stream/<name>')
def stream(name):
    args = stream_args(request.args)
    data = redis_api.get_streams(redis, [name], **args)

    return jsonify(values=data)

# get data and subscribe to a stream
@app.route('/online/stream_subscribe/<name>')
def stream_subscribe(name):
    args = stream_args(request.args)
    def event_stream():
        for data in subscribe_streams(redis, [name], **args):
            ret = "data: %s\n\n" % json.dumps(data)
            yield ret 
    return Response(event_stream(), mimetype="text/event-stream")

# get a simple key
@app.route("/key/<keyname>")
def key(keyname):
    return jsonify(value=redis_api.get_key(redis, keyname))

@app.route('/online/stream_group/<stream_type>/<list:metric_names>/<instance_name>/<int:field_start>/<int:field_end>')
@app.route('/online/stream_group/<stream_type>/<list:metric_names>/<instance_name>/<list:field_list>')
def stream_group(stream_type, metric_names, instance_name, field_start=None, field_end=None, field_list=None):
    args = stream_args(request.args)

    if field_list is not None:
        fields = field_list
    else: 
        fields = [str(x) for x in range(field_start, field_end)]

    stream_names = []
    for metric in metric_names:
        for inst in fields:
            this_stream_name = "%s:%s:%s:%s" % (instance_name, inst, metric, stream_type)
            stream_names.append( this_stream_name )

    if args is None:
        data = redis_api.get_last_streams(redis, stream_names)
    else:
        data = redis_api.get_streams(redis, stream_names, **args)

    # get the least most updated stream for the front end
    min_end_time = 0
    for _, val in data.items():
        if len(val) == 0:
            continue
        this_end_time = val[-1][0]
        if min_end_time == 0 or this_end_time < min_end_time:
            min_end_time = this_end_time

    ret = {}
    # transform internal key representation into representation for front end
    for key, series in data.items():
        info = key.split(":")
        metric = info[2]
        field = info[1]
        if metric not in ret:
            ret[metric] = {}
        ret[metric][field] = series

    return jsonify(values=ret, min_end_time=min_end_time)

@app.route('/online/infer_step_size/<stream_type>/<metric_name>/<instance_name>/<field_name>')
def infer_step_size(stream_type, metric_name, instance_name, field_name):
    key = "%s:%s:%s:%s" % (instance_name, field_name, metric_name, stream_type)
    data = redis_api.get_last_streams(redis, [key], count=2)
    times = [t for t, _ in data[key]] 
    
    if len(times) < 2:
        avg_delta_times = 0
    else:
        sum_delta_times = 0
        for i in range(len(times) - 1):
            sum_delta_times += int(times[i]) - int(times[i+1])
        avg_delta_times = sum_delta_times / (len(times) - 1)
    return jsonify(step=avg_delta_times)

# internal API for accessing series associated with an instance
def get_series(instance_link, field_link):
    time_series = redis.keys("%s:%s:*" % (instance_link, field_link)) 
    ret = {}
    # name of api link to access the stream
    stream_link = "/online"
    for key in time_series:
        split = key.split(":")
        metric = split[2]
        stream_type = split[3]
        if metric in ret:
            ret[metric].append((stream_type, stream_link))
        else:
            ret[metric] = [(stream_type, stream_link)]
    return ret
    


