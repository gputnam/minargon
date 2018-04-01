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

    now = int(time.time())

    # adjust for clock skew
    dt = now_client - now
    start -= dt
    stop -= dt
    p = redis.pipeline()
    for i in range(int(start),int(stop),step):
        p.get('stream/1:%i:channel_data:%i' % (i,channel))
    result = []
    for x in p.execute():
        if x:
            json_dict = json.loads(x)
            if expr in json_dict:
                result.append(json_dict[expr])
                continue
        result.append( 0 )
        
    return jsonify(values=result)

@app.route('/generic_metric')
def generic_metric():
    args = request.args

    expr = args.get('expr',type=str)
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

    if step > 60:
        t = 60
    else:
        t = 1

    p = redis.pipeline()
    for i in range(int(start),int(stop),step):
        p.get('stream/%i:%i:%s' % (t,i//t,expr))
    result = [float(x) if x else 0 for x in p.execute()]

    if t == 60:
        p = redis.pipeline()
        for i in range(start,stop,step):
            p.get('stream/60:%i:count' % (i//t))
        counts = [int(x) if x else 0 for x in p.execute()]
        result = [a/b for a, b in zip(result,counts)]

    return jsonify(values=result)

