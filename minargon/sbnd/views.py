from minargon import app
from flask import render_template, jsonify, request, redirect, url_for, flash, abort
import time
from os.path import join
import json
import os
import sys
import random
import constants
import sys
from minargon.metrics import postgres_api
from minargon.common.views import timeseries_view
import subprocess
import re

from minargon.tools import parseiso
# from minargon.data_config import parse
from minargon.metrics import online_metrics

# snapshot of noise (currently just correlation matrix)
@app.route('/noise_snapshot')
def noise_snapshot():
    template_args = {
        'n_channels': constants.N_CHANNELS
    }
    return render_template('sbnd/noise_snapshot.html', **template_args)

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
    return render_template('sbnd/fem_snapshot.html', **template_args)

# snapshot of data on channel (fft and waveform)
@app.route('/channel_snapshot')
def channel_snapshot():
    channel = request.args.get('channel', 0, type=int)

    view_ind = {'channel': channel}
    view_ind_opts = {'channel': range(constants.N_CHANNELS)}

    instance_name = "wireplane"
    config = online_metrics.get_group_config(instance_name)

    template_args = {
        'channel': channel,
        'config': config,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
    }
    return render_template('sbnd/channel_snapshot.html', **template_args)

# view of a number of wires on a wireplane
@app.route('/wireplane_view')
def wireplane_view():
    plane = request.args.get('plane', 'combined')
    instance_name = "tpc_channel" 
    return timeseries_view(request.args, instance_name, "wire", "wireLink")

@app.route('/purity')
def purity():
    config = online_metrics.get_group_config("TPC")

    render_args = {
      'config': config
    }

    return render_template('sbnd/purity.html', **render_args)


