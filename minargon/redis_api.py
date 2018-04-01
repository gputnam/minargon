from . import app
from flask import render_template, jsonify, request, redirect, url_for, flash
import time
from redis import Redis
from os.path import join
import json
import os
import sys
import random
import constants
from tools import parseiso

redis = Redis()
PROGRAMS = []

"""
	Routes for getting stuff from Redis
"""

@app.route('/snapshot/<data>')
def snapshot(data):
    redis_key = "snapshot:%s" % data
    for (k, v) in request.args.iteritems():
        redis_key += ":%s:%s" % (k, v)
    key_type = redis.type(redis_key)
    if key_type == "list":
        redis_data = list(redis.lrange(redis_key, 0, -1))
    elif key_type == "string":
        redis_data = redis.get(redis_key)
    else:
        redis_data = 0 
    print redis_key
    return jsonify(value=redis_data)

@app.route('/correlation')
def correlation():
    n_correlation_values = (constants.N_CHANNELS+1)*constants.N_CHANNELS/2 
    correlation = list(redis.lrange('snapshot:correlation',0, n_correlation_values-1))
    return jsonify(correlation=correlation,n_channels=constants.N_CHANNELS)

@app.route('/snapshot_data')
def snapshot_data():
    channel = request.args.get('channel', type=int)
    data_type = request.args.get('data')
    
    data = redis.lrange("snapshot:%s:%i" % (data_type, channel), 0, -1)
    ret = {}
    ret[data_type] = data
    return jsonify(**ret)

@app.route('/snapshot_time')
def snapshot_time():
    time = redis.get('snapshot_time')
    return jsonify(timestamp=time)

def stream_data(base_key, stream, start, stop, step, now_client, data_map):
    now = int(time.time())

    # adjust for clock skew
    dt = now_client - now
    start -= dt
    stop -= dt
    p = redis.pipeline()
    for i in range(int(start),int(stop),step):
        key = ('stream/%i:%i:' % (stream, i)) + base_key
        p.get(key)
    result = [data_map(x) for x in p.execute()]
        
    return result

@app.route('/channel_data')
def channel_data():
    args = request.args

    expr = args.get('expr',type=str)
    channel = args.get('channel',0,type=int)
    start = args.get('start',type=parseiso)
    stop = args.get('stop',type=parseiso)
    now_client = args.get('now',type=parseiso)
    # convert ms -> sec
    step = args.get('step',type=int)//1000

    base_key = "channel_data:wire:%i" % channel
    def channel_data_map(x):
        if x:
            json_dict = json.loads(x)
            if expr in json_dict:
                return json_dict[expr]
        return 0

    data = stream_data(base_key, 1, start, stop, step, now_client, channel_data_map)
    return jsonify(values=data)

@app.route('/stream/<stream_no>/<data>')
def stream(stream_no, data):
    stream_no = int(stream_no)
    base_key = data
    for (k, v) in request.args.iteritems():
        if not k in ['start', 'stop', 'now', 'step']:
            base_key += ":%s:%s" % (k, v)
 
    args = request.args
    start = args.get('start',type=parseiso)
    stop = args.get('stop',type=parseiso)
    now_client = args.get('now',type=parseiso)
    # convert ms -> sec
    step = args.get('step',type=int)//1000


    data = stream_data(base_key, stream_no, start, stop, step, now_client, float)
    return jsonify(values=data)

