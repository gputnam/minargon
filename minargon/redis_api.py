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
import math

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

def stream_data(base_key, stream, args, data_map):
    start = args.get('start',type=parseiso)
    stop = args.get('stop',type=parseiso)
    now_client = args.get('now',type=parseiso)
    # convert ms -> sec
    step = args.get('step',type=int)//1000
    now = int(time.time())

    # adjust for clock skew
    dt = now_client - now
    start -= dt
    stop -= dt
    p = redis.pipeline()
    for i in range(int(start),int(stop),step):
        key = ('stream/%i:%i:' % (stream, i)) + base_key
        p.get(key)

    def check_and_map(x):
        if not x:
            return 0
        else:
            return data_map(x)

    result = [check_and_map(x) for x in p.execute()]
        
    return result

def clean_float(x):
    ret = float(x)
    if math.isnan(ret):
        ret = "NaN"
    return ret

@app.route('/channel_data')
def channel_data():
    args = request.args

    expr = args.get('expr',type=str)
    channel = args.get('channel',0,type=int)

    base_key = "channel_data:wire:%i" % channel
    def channel_data_map(x):
        json_dict = json.loads(x)
        if expr in json_dict:
            return json_dict[expr]
        return 0

    data = stream_data(base_key, 1, args, channel_data_map)
    return jsonify(values=data)

@app.route('/stream/<stream_no>/<data>/<board>')
@app.route('/stream/<stream_no>/<data>/<board>/<fem>')
@app.route('/stream/<stream_no>/<data>/<board>/<fem>/<channel>')
def stream(stream_no, data, board, fem=None, channel=None):
    stream_no = int(stream_no)
    base_key = data
    if board is not None:
        base_key += ":board:%s" % board
    if fem is not None:
        base_key += ":fem:%s" % fem
    if channel is not None:
        base_key += ":channel:%s" % channel
 
    args = request.args
  
    data = stream_data(base_key, stream_no, args, clean_float)
    return jsonify(values=data)

@app.route('/power_stream/<stream_no>/<data>/<supply_name>')
def power_stream(stream_no, data, supply_name):
    stream_no = int(stream_no)
    base_key = "%s:%s" % (data , supply_name)
 
    args = request.args

    data = stream_data(base_key, stream_no, args, clean_float)
    return jsonify(values=data)

