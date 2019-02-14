from minargon import app
from flask import render_template, jsonify, request, redirect, url_for, flash
import time
from os.path import join
import json
import os
import sys
import random
import constants
import sys

from minargon.tools import parseiso
from minargon.data_config import parse
from minargon.metrics import online_metrics

# load data configuration file
DATA_CONFIG = parse.DataParser(app.config).config

"""
	Routes intented to be seen by the user	
"""

@app.route('/test_error')
def test_error():
    sys.stderr.write("Flask error logging test")
    raise Exception("Flask exception logging test")

@app.route('/hello')
def hello():
    return 'Hello 2!'

@app.route('/')
def index():
    return redirect(url_for('introduction'))

@app.route('/introduction')
def introduction():
    return render_template('introduction.html')

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

    instance_name = "combined plane"
    instance = DATA_CONFIG.get_instance(instance_name)

    metrics_to_streams = online_metrics.get_series(instance.link, instance.fields.items()[0][1].link)
    # turn dict into list of metrics and list of streams
    # require any used stream by used by all metrics
    metric_list = [key for key,_ in metrics_to_streams.items()] 
    if len(metric_list) > 0:
        stream_list, stream_links = zip(*metrics_to_streams[metric_list[0]])
    else:
        stream_list = []
        stream_links = []

    template_args = {
        'channel': channel,
        'timeseries': DATA_CONFIG.data_field_timeseries(instance, "wire %i" % channel),
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
        'streams': stream_list,
        'stream_links': stream_links,
    }
    return render_template('channel_snapshot.html', **template_args)

# the view associated with a number of channels on an fem 
@app.route('/fem_view')
def fem_view():
    fem = request.args.get('fem', 0, type=int)
    instance_name = "fem %i" % fem
    return timeseries_view(request.args, instance_name, "channel", "wireLink")

# view of a number of fem's on a readout crate
@app.route('/crate_view')
def crate_view():
    #crate = request.args.get('crate', 0, type=int)
    #instance_name = "crate %i" % crate
    instance_name = "crate"
    return timeseries_view(request.args, instance_name, "FEM", "femLink")

# view of a number of crates in the readout
@app.route('/readout_view')
def readout_view():
    instance_name = "readout"
    return timeseries_view(request.args, instance_name, "crate", "crateLink")

# view of a number of wires on a wireplane
@app.route('/wireplane_view')
def wireplane_view():
    plane = request.args.get('plane', 'combined')
    instance_name = "%s plane" % plane
    return timeseries_view(request.args, instance_name, "wire", "wireLink")

@app.route('/single_stream/<stream_name>/')
def single_stream(stream_name):
    render_args = {
        "stream_name": stream_name,
    }
    return render_template('single_stream.html', **render_args) 
    

def timeseries_view(args, instance_name, view_ident="", link_function="undefined"):
    instance = DATA_CONFIG.get_instance(instance_name)
    metrics_to_streams = online_metrics.get_series(instance.link, instance.fields.items()[0][1].link)
    # turn dict into list of metrics and list of streams
    # require any used stream by used by all metrics
    metric_list = [key for key,_ in metrics_to_streams.items()] 
    if len(metric_list) > 0:
        stream_list, stream_links = zip(*metrics_to_streams[metric_list[0]])
    else:
        stream_list = []
        stream_links = []
    # get the config associated with each metric
    master_config = DATA_CONFIG.get_metrics()
    metric_config = {}
    for metric in metric_list:
        if metric in master_config:
            metric_config[metric] = master_config[metric]
        else:
            metric_config[metric] = []

    instance = DATA_CONFIG.get_instance(instance_name)
    timeseries = DATA_CONFIG.data_instance_timeseries(instance, metric_config, maxn=25)
    field_data = DATA_CONFIG.data_instance_field_data(instance, metric_config)
    initial_datum = args.get('data', 'rms')

    render_args = {
        'metric': initial_datum,
        'timeseries': timeseries,
        'title': instance_name,
        'field_data': field_data,
        'view_ident': view_ident,
        'link_function': link_function,
        'streams': stream_list,
        'stream_links': stream_links
    }

    return render_template('timeseries.html', **render_args)
    

@app.route('/purity')
def purity():
    timeseries = DATA_CONFIG.data_field_timeseries("TPC", "TPC")

    render_args = {
      'timeseries': timeseries
    }

    return render_template('purity.html', **render_args)


