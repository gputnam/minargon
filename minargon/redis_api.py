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

redis = Redis(host=app.config["REDIS_HOST"], port=int(app.config["REDIS_PORT"]))
PROGRAMS = []

"""
	Routes for getting stuff from Redis
"""

@app.route('/test_redis')
def test_redis():
    try:
        x = redis.get("foo")
    except Exception, err:
        sys.stderr.write('ERROR: %sn' % str(err))
        raise Exception("Redis cannot get foo")
    return str(x)

# get a datum stored in a snapshot
@app.route('/snapshot/<data>')
def snapshot(data):
    redis_key = "snapshot:%s" % data
    # args should be key-value pairs of specifiers in the redis keys
    # e.g. /snapshot/waveform?wire=1
    # decodes to the redis key snapshot:waveform:wire:1
    for (k, v) in request.args.iteritems():
        redis_key += ":%s:%s" % (k, v)
    # stuff in snapshots may be individual values or lists
    key_type = redis.type(redis_key)
    if key_type == "list":
        redis_data = list(redis.lrange(redis_key, 0, -1))
    elif key_type == "string":
        redis_data = redis.get(redis_key)
    else:
        redis_data = 0 
    return jsonify(value=redis_data)

def check_and_map(x, data_map):
    if not x:
        return 0
    else:
        return data_map(x)

# get the most recent data point from redis for a list of wires
def query_data(data, stream_no, wire_range, data_map):
    # get the most recent data on the stream 
    # go back one time step to be safe
    now = int(time.time())//stream_no - 1
    p = redis.pipeline()
    for wire in wire_range:
        key = 'stream/%i:%i:%s:wire:%i' % (stream_no, now, data, wire)
        p.get(key)
    result = [check_and_map(x, data_map) for x in p.execute()]
    return result

# get all data points in args.start, args.stop for a single
# base redis key
def stream_data(base_key, stream, args, data_map):
    start = args.get('start',type=parseiso)
    stop = args.get('stop',None,type=parseiso)
    now_client = args.get('now',type=parseiso)
    # convert ms -> sec
    step = args.get('step',type=int)//1000
    now = int(time.time())

    if stop == None:
        stop = int(start) + step

    # adjust for clock skew
    dt = now_client - now
    start -= dt
    stop -= dt
    p = redis.pipeline()
    for i in range(int(start),int(stop),step):
        key = 'stream/%i:%i:%s' % (stream, i//stream, base_key)
        p.get(key)


    result = [check_and_map(x, data_map) for x in p.execute()]
        
    return result

def clean_float(x):
    ret = float(x)
    if math.isnan(ret):
        ret = "NaN"
    return ret


# getting data on a crate
@app.route('/stream/<stream_no>/<data>/<crate>')
# on an fem
@app.route('/stream/<stream_no>/<data>/<crate>/<fem>')
# on a channel
@app.route('/stream/<stream_no>/<data>/<crate>/<fem>/<channel>')
def stream(stream_no, data, crate, fem=None, channel=None):
    stream_no = int(stream_no)
    base_key = data
    if crate is not None:
        base_key += ":crate:%s" % crate
    if fem is not None:
        base_key += ":fem:%s" % fem
    if channel is not None:
        base_key += ":channel:%s" % channel
 
    args = request.args
  
    data = stream_data(base_key, stream_no, args, clean_float)
    return jsonify(values=data)

# querrying data points from the most recent timestamp from a list of wires
# wire_list here is a comma separated list of wires
@app.route('/wire_query/<stream_no>/<data>/<wire_list>')
# wire_start, wire_end map to a wire_list = [wire_start, ... ,wire_end)
@app.route('/wire_query/<stream_no>/<data>/<wire_start>/<wire_end>')
def wire_query(stream_no, data, wire_start=None, wire_end=None, wire_list=None):
    if wire_list is not None:
        wire_range = [int(x) for x in wire_list.split(",")]
    else: 
        wire_range = range(int(wire_start), int(wire_end))

    stream_no = int(stream_no)
 
    data = query_data(data, stream_no, wire_range, clean_float)
    return jsonify(values=data)

# stream data for a wire 
# pass in the wire id, as opposed to the crate/fem/channel id as above
@app.route('/wire_stream/<stream_no>/<data>/<wire>')
def wire_stream(stream_no, data, wire):
    stream_no = int(stream_no)
    base_key = "%s:wire:%s" % (data, wire)
 
    data = stream_data(base_key, stream_no, request.args, clean_float)
    return jsonify(values=data)
    

# access stream data for a power supply
# power supplies are identified by name instead of id's
@app.route('/power_stream/<stream_no>/<data>/<supply_name>')
def power_stream(stream_no, data, supply_name):
    stream_no = int(stream_no)
    base_key = "%s:%s" % (data , supply_name)
 
    args = request.args

    data = stream_data(base_key, stream_no, args, clean_float)
    return jsonify(values=data)

