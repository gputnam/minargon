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
from tools import parseiso, parseiso_or_int
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

def get_time_index(skip):
    return int(time.time())//skip - 1

def get_subrun_index():
    value = redis.get("last_subrun_no")
    if value is None:
        return 0
    else:
        return int(value)

def get_run_index():
    value = redis.get("this_run_no")
    if value is None:
        return 0
    else:
        return int(value)

# get the most recent data point from redis for a list of wires
def query_data(data, args, wire_range, data_map):
    stream_name = args.get('stream_name')
    index = args.get('start', None, type=parseiso_or_int)
    skip = args.get('skip', None, type=int)
    # backup if index is none
    if index is None:
        # case for sub_run stream
        if stream_name == "sub_run":
            index = get_subrun_index()
        # case for time stream
        elif skip is not None:
            index = get_time_index(skip)
        # neither sub_run nor time stream -- bad
        else:
            raise Exception("Bad Redis Request")
        
    # get the most recent data on the stream 
    # go back one time step to be safe
    p = redis.pipeline()
    for wire in wire_range:
        key = 'stream/%s:%i:%s:wire:%i' % (stream_name, index, data, wire)
        p.get(key)
    result = [check_and_map(x, data_map) for x in p.execute()]
    return result, index

# get all data points in args.start, args.stop for a single
# base redis key
def stream_data(base_key, args, data_map):
    stream_name = args.get('stream_name')
    start = args.get('start',None,type=parseiso_or_int)
    stop = args.get('stop',None,type=parseiso_or_int)
    now_client = args.get('now',type=parseiso_or_int)
    # convert ms -> sec
    step = args.get('step',1000,type=int)//1000
    now = int(time.time())

    # adjust for clock skew
    # if not sub_run stream
    if stream_name != "sub_run":
	dt = now_client - now
	start -= dt
	stop -= dt

    if start is None: 
        # case for sub_run stream
        if stream_name == "sub_run":
            start = get_subrun_index()
            stream_name = "%s_%i" % (stream_name, get_run_index())
        # case for time stream
        elif skip is not None:
            start = get_time_index(skip)
        # neither sub_run nor time stream -- bad
        else:
            raise Exception("Bad Redis Request")
        
    if stop is None:
        stop = int(start) + step

    p = redis.pipeline()
    for i in range(int(start),int(stop),step):
        key = 'stream/%s:%i:%s' % (stream_name, i//step, base_key)
        p.get(key)


    result = [check_and_map(x, data_map) for x in p.execute()]
        
    return result, start

def clean_float(x):
    ret = float(x)
    if math.isnan(ret):
        ret = "NaN"
    return ret


# getting data on a crate
@app.route('/stream/<data>/<crate>')
# on an fem
@app.route('/stream/<data>/<crate>/<fem>')
# on a channel
@app.route('/stream/<data>/<crate>/<fem>/<channel>')
def stream(data, crate, fem=None, channel=None):
    base_key = data
    if crate is not None:
        base_key += ":crate:%s" % crate
    if fem is not None:
        base_key += ":fem:%s" % fem
    if channel is not None:
        base_key += ":channel:%s" % channel
 
    args = request.args
  
    data, start = stream_data(base_key, args, clean_float)
    return jsonify(values=data, index=start)

# querrying data points from the most recent timestamp from a list of wires
# wire_list here is a comma separated list of wires
@app.route('/wire_query/<data>/<wire_list>')
# wire_start, wire_end map to a wire_list = [wire_start, ... ,wire_end)
@app.route('/wire_query/<data>/<wire_start>/<wire_end>')
def wire_query(data, wire_start=None, wire_end=None, wire_list=None):
    if wire_list is not None:
        wire_range = [int(x) for x in wire_list.split(",")]
    else: 
        wire_range = range(int(wire_start), int(wire_end))

    data, index = query_data(data, request.args, wire_range, clean_float)
    return jsonify(values=data, index=index)

# stream data for a wire 
# pass in the wire id, as opposed to the crate/fem/channel id as above
@app.route('/wire_stream/<data>/<wire>')
def wire_stream(data, wire):
    base_key = "%s:wire:%s" % (data, wire)
 
    data, start = stream_data(base_key, request.args, clean_float)
    return jsonify(values=data, index=start)
    

# access stream data for a power supply
# power supplies are identified by name instead of id's
@app.route('/power_stream/<data>/<supply_name>')
def power_stream(data, supply_name):
    base_key = "%s:%s" % (data , supply_name)
 
    args = request.args

    data, start = stream_data(base_key, args, clean_float)
    return jsonify(values=data, index=start)

# get a list of recent warnings
@app.route('/get_warnings/<max_n>/')
@app.route('/get_warnings/<max_n>/<start>')
@app.route('/get_warnings/<max_n>/<start>/<stop>')
def get_warnings(max_n, start=None, stop=None):
    if start is None:
        start = 0
    if stop is None:
        stop = get_time_index(1)
    warnings = redis.zrevrangebyscore("WARNINGS", int(start), int(stop), num=int(max_n), start=-1)
    json_data = [json.loads(w) for w in warnings]
    return jsonify(warnings=json_data)

# get last time online analysis ran
@app.route("/key/<keyname>")
def key(keyname):
    keystr = redis.get(keyname)
    try:
        keyint = int(keystr)
    except:
        keyint = 0
    return jsonify(value=keyint)


