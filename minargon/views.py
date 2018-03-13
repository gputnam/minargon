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
    result = [json.loads(x)[expr] if x else 0 for x in p.execute()]
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

