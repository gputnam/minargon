from . import app
from flask import render_template, jsonify, request, redirect, url_for, flash
import time
from redis import Redis
from os.path import join
import json
import os
import sys
import random
from tools import parseiso

redis = Redis()
PROGRAMS = []


@app.route('/hello')
def hello():
    return 'Hello!'

@app.route('/')
def index():
    return redirect(url_for('vststream'))

@app.route('/docs/')
@app.route('/docs/<filename>')
@app.route('/docs/<dir>/<filename>')
@app.route('/docs/<dir>/<subdir>/<filename>')
def docs(dir='', subdir='', filename='index.html'):
    path = join('docs', dir, subdir, filename)
    return app.send_static_file(path)

@app.route('/vststream')
def snostream():
    if len(request.args) == 0:
        return redirect(url_for('snostream',step=1,height=20,_external=True))
    step = request.args.get('step',1,type=int)
    height = request.args.get('height',40,type=int)
    return render_template('vststream.html',step=step,height=height)

@app.route('/status')
def status():
    return render_template('status.html', programs=PROGRAMS)

@app.route('/system_monitor')
def system_monitor():
    if not request.args.get('step'):
        return redirect(url_for('system_monitor',step=1,height=20,_external=True))
    step = request.args.get('step',1,type=int)
    height = request.args.get('height',40,type=int)
    per_channel_datums = request.args.get('channel_data', "", type=str).split(",")
    if per_channel_datums == ['']:
        per_channel_datums = []
    n_channels = request.args.get('n_channels', 16, type=int)
    render_args = {
        'step': step,
        'height': height,
        'per_channel_datums': per_channel_datums,
        'n_channels': n_channels,
        'channel_data_str': request.args.get('channel_data', "", type=str)
    }
    return render_template('system_monitor.html', **render_args)

@app.route('/noise_monitor')
def noise_monitor():
    if not request.args.get('step'):
        return redirect(url_for('system_monitor',step=1,height=20,_external=True))
    step = request.args.get('step',1,type=int)
    height = request.args.get('height',40,type=int)
    n_channels = request.args.get('n_channels', 16, type=int)
    render_args = {
        'step': step,
        'height': height,
        'n_channels': n_channels,
        'channel_data_str': request.args.get('channel_data', "", type=str)
    }
    return render_template('noise_monitor.html', **render_args)

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

@app.route('/hello_world_metric')
def hello_world_metric():
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

@app.route('/query')
def query():
    name = request.args.get('name','',type=str)

    if name == 'dispatcher':
        return jsonify(name=redis.get('dispatcher'))

    if 'nhit' in name:
        seconds = request.args.get('seconds',type=int)

        now = int(time.time())

        p = redis.pipeline()
        for i in range(seconds):
            p.lrange('ts:1:{ts}:{name}'.format(ts=now-i,name=name),0,-1)
        nhit = map(int,sum(p.execute(),[]))
        return jsonify(value=nhit)

    if name in ('occupancy','cmos','base'):
        now = int(time.time())
        step = request.args.get('step',60,type=int)

        interval = get_hash_interval(step)

        i, remainder = divmod(now, interval)

        def div(a,b):
            if a is None or b is None:
                return None
            return float(a)/float(b)

        if remainder < interval//2:
            # haven't accumulated enough data for this window
            # so just return the last time block
            if redis.ttl('ts:%i:%i:%s:lock' % (interval,i-1,name)) > 0:
                # if ttl for lock exists, it means the values for the last
                # interval were already computed
                values = redis.hmget('ts:%i:%i:%s' % (interval, i-1, name),CHANNELS)
                return jsonify(values=values)
            else:
                i -= 1

        if name in ('cmos', 'base'):
            # grab latest sum of values and divide by the number
            # of values to get average over that window
            sum_ = redis.hmget('ts:%i:%i:%s:sum' % (interval,i,name),CHANNELS)
            len_ = redis.hmget('ts:%i:%i:%s:len' % (interval,i,name),CHANNELS)

            values = map(div,sum_,len_)
        else:
            hits = redis.hmget('ts:%i:%i:occupancy:hits' % (interval,i), CHANNELS)
            count = int(redis.get('ts:%i:%i:occupancy:count' % (interval,i)))
            if count > 0:
                values = [int(n)/count if n is not None else None for n in hits]
            else:
                values = [None]*len(CHANNELS)

        return jsonify(values=values)

