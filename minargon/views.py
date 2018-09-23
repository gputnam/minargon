from . import app
from flask import render_template, jsonify, request, redirect, url_for, flash
import time
from os.path import join
import json
import os
import sys
import random
import constants
import sys

from tools import parseiso
from parse import parse

# load data configuration file
DATA_CONFIG = parse.DataParser(app.config).config

"""
	Routes intented to be seen by the user	
"""

@app.route('/test_error')
def test_error():
    sys.stderr.write("Flask error logging test")
    raise Exception("Flask exception logging test")

@app.route('/test_static')
def test_static():
    return render_template('test_static.html')

@app.route('/hello')
def hello():
    return 'Hello 2!'

@app.route('/')
def index():
    return redirect(url_for('introduction'))

@app.route('/introduction')
def introduction():
    return render_template('introduction.html')

@app.route('/recent_warnings')
def recent_warnings():
    return render_template('recent_warnings.html')

@app.route('/nevis_readout')
def nevis_readout():
    render_args = {
      'n_fem': constants.N_FEM,
      'header_metrics': constants.HEADER_DATA,
    }
    return render_template('nevis_readout.html', **render_args) 

@app.route('/docs/')
@app.route('/docs/<filename>')
@app.route('/docs/<dir>/<filename>')
@app.route('/docs/<dir>/<subdir>/<filename>')
def docs(dir='', subdir='', filename='index.html'):
    path = join('docs', dir, subdir, filename)
    return app.send_static_file(path)

# snapshot of noise (currently just correlation matrix)
@app.route('/noise_snapshot')
def noise_snapshot():
    template_args = {
        'n_channels': constants.N_CHANNELS
    }
    return render_template('noise_snapshot.html', **template_args)

# snapshot of data on channel (fft and waveform)
@app.route('/fem_snapshot')
def fem_snapshot():
    fem = request.args.get('fem', 0, type=int)

    view_ind = {'fem': fem}
    view_ind_opts = {'fem': range(constants.N_FEM)}

    template_args = {
        'fem': fem,
        'view_ind_opts': view_ind_opts,
        'view_ind': view_ind,
    }
    return render_template('fem_snapshot.html', **template_args)

# snapshot of data on channel (fft and waveform)
@app.route('/channel_snapshot')
def channel_snapshot():
    channel = request.args.get('channel', 0, type=int)

    view_ind = {'channel': channel}
    view_ind_opts = {'channel': range(constants.N_CHANNELS)}

    template_args = {
        'channel': channel,
        'steps': constants.REDIS_TIME_STEPS,
        'data_types': constants.CHANNEL_DATA,
        'default_step': request.args.get('step', constants.REDIS_TIME_STEPS[0], type=int),
        'view_ind_opts': view_ind_opts,
        'view_ind': view_ind,
    }
    return render_template('channel_snapshot.html', **template_args)

# args used by view's which involve stream metrics 
def stream_metric_args(args):
    return {
        'steps': constants.REDIS_TIME_STEPS,
        'detector': constants.detector,
        'initial_datum': args.get('data', 'rms'),
        'default_step': args.get('step', constants.REDIS_TIME_STEPS[0], type=int),
    }

# the view associated with a number of channels on an fem 
@app.route('/fem_view')
def fem_view():
    fem = request.args.get('fem', 0, type=int)
    crate = request.args.get('crate', 0, type=int)
    initial_datum = request.args.get('data', 'rms')
    data = constants.CHANNEL_DATA

    view_ind = {
      'fem': fem,
      'crate': crate,
    }

    view_ind_opts = {
      'fem': range(constants.N_FEM_PER_CRATE), 
      'crate': range(constants.N_CRATES)
    }

    render_args = {
        'data': data,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
        'view_type': 'fem',
    }

    render_args = dict(render_args, **stream_metric_args(request.args))

    return render_template('readout_view.html', **render_args)

# view of a number of fem's on a readout crate
@app.route('/crate_view')
def crate_view():
    crate = request.args.get('crate', 0, type=int)
    initial_datum = request.args.get('data', 'rms')
    n_channels_per_fem = constants.N_CHANNELS_PER_FEM
    data = constants.FEM_DATA

    view_ind = {
      'crate': crate
    }

    view_ind_opts = {
        'crate': range(constants.N_CRATES)
    }

    render_args = {
        'data': data,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
        'view_type': 'crate',
    }
    render_args = dict(render_args, **stream_metric_args(request.args))

    return render_template('readout_view.html', **render_args)

# view of a number of fem's on a readout crate
@app.route('/readout_view')
def readout_view():
    initial_datum = request.args.get('data', 'rms')
    data = constants.FEM_DATA

    view_ind = {}

    view_ind_opts = {}

    render_args = {
        'data': data,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
        'view_type': 'readout',
    }
    render_args = dict(render_args, **stream_metric_args(request.args))

    return render_template('readout_view.html', **render_args)


# view of a number of wires on a wireplane
@app.route('/wireplane_view')
def wireplane_view():
    plane = request.args.get('plane', 'combined')
    initial_datum = request.args.get('data', 'rms')
    data = constants.CHANNEL_DATA
 
    view_ind = {
        'plane': plane
    }
    view_ind_opts = {
        'plane': constants.PLANES
    }

    render_args = {
        'data': data,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
        'view_type': 'wireplane',
        'initial_datum': initial_datum,
    }

    render_args = dict(render_args, **stream_metric_args(request.args))

    return render_template('wireplane_view.html', **render_args)

@app.route('/test/wireplane_view2')
def wireplane_view2():
    plane = request.args.get('plane', 'combined')
    initial_datum = request.args.get('data', 'rms')

    instance_name = "%s plane" % plane
    timeseries = DATA_CONFIG.data_instance_timeseries(instance_name)

    render_args = {
        'metric': initial_datum,
        'timeseries': timeseries.to_json(maxn=25),
        'title': instance_name
    }

    return render_template('timeseries.html', **render_args)
    

@app.route('/purity')
def purity():

    view_ind = {}

    view_ind_opts = {}
    render_args = {
        'data_types': constants.EVENT_INFO_DATA,
        'default_step': request.args.get('step', constants.EVENT_INFO_TIME_STEPS[0], type=float),
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
        'view_type': 'readout',
        'steps': constants.EVENT_INFO_TIME_STEPS,
    }
#    render_args = dict(render_args, **stream_metric_args(request.args))

    return render_template('purity.html', **render_args)


