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
    template_args = {
        'n_channels': constants.N_CHANNELS
    }
    return render_template('noise_snapshot.html', **template_args)

@app.route('/channel_snapshot')
def channel_snapshot():
    channel = request.args.get('channel', 0, type=int)
    template_args = {
        'channel': channel,
        'steps': constants.REDIS_TIME_STEPS
    }
    return render_template('channel_snapshot.html', **template_args)

def crate_view_args(args):
    return {
        'steps': constants.REDIS_TIME_STEPS,
        'detector': constants.detector,
        'inital_datum': args.get('data', 'rms'),
    }

@app.route('/wires')
def wires():
    fem = request.args.get('fem', 0, type=int)
    card = request.args.get('card', 0, type=int)
    initial_datum = request.args.get('data', 'rms')
    data = constants.CHANNEL_DATA

    view_ind = {
      'fem': fem, 
      'card': card
    }

    render_args = {
        'data': data,
        'view_ind': view_ind,
        'view_type': 'channel',
    }

    render_args = dict(render_args, **crate_view_args(request.args))

    return render_template('crate_view.html', **render_args)

@app.route('/fem_view')
def fem_view():
    card = request.args.get('card', 0, type=int)
    initial_datum = request.args.get('data', 'rms')
    n_channels_per_fem = constants.N_CHANNELS_PER_FEM
    data = constants.FEM_DATA

    view_ind = {
      'card': card
    }

    render_args = {
        'data': data,
        'view_ind': view_ind,
        'view_type': 'fem',
    }
    render_args = dict(render_args, **crate_view_args(request.args))

    return render_template('crate_view.html', **render_args)

@app.route('/board_view')
def board_view():
    initial_datum = request.args.get('data', 'rms')
    n_channels_per_fem = constants.N_CHANNELS_PER_FEM
    data = constants.BOARD_DATA

    view_ind = {}

    render_args = {
        'data': data,
        'view_ind': view_ind,
        'view_type': 'board',
    }
    render_args = dict(render_args, **crate_view_args(request.args))

    return render_template('crate_view.html', **render_args)

@app.route('/power_supplies')
def power_supplies():
    supply = "PL506"
    render_args = {
        'data': constants.POWER_SUPPLY_DATA,
        'supply_name': supply,
        'steps': constants.REDIS_POWER_SUPPLY_TIME_STEPS,
    }

    return render_template('power_supplies.html', **render_args)

