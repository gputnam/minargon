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
	Routes intented to be seen by the user	
"""

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

@app.route('/noise_snapshot')
def noise_snapshot():
    return render_template('noise_snapshot.html')

@app.route('/channel_snapshot')
def channel_snapshot():
    channel = request.args.get('channel', 0, type=int)
    template_args = {
        'channel': channel,
        'steps': constants.REDIS_TIME_STEPS
    }
    return render_template('channel_snapshot.html', **template_args)

@app.route('/wires')
def wires():
    fem = request.args.get('fem', 0, type=int)
    card = request.args.get('card', 0, type=int)
    initial_datum = request.args.get('data', 'rms')
    n_channels = constants.N_CHANNELS
    data = constants.CHANNEL_DATA
    steps = constants.REDIS_TIME_STEPS

    render_args = {
        'n_channels_per_fem': n_channels,
        'data': data,
        'steps': steps,
        'fem': fem,
        'card': card,
        'intial_datum': initial_datum,
    }
    return render_template('wire_data.html', **render_args)

