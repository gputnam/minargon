from minargon import app
from flask import render_template, jsonify, request, redirect, url_for, flash
from minargon.metrics import postgres_api

from minargon.tools import parseiso
from minargon.metrics import online_metrics

"""
	Routes intented to be seen by the user	
"""

@app.route('/')
def index():
    return redirect(url_for('introduction2'))

@app.route('/introduction2')
def introduction2():
    return render_template('introduction.html')

@app.route('/online_group/<group_name>')
def online_group(group_name):
    return timeseries_view(request.args, group_name)

@app.route('/single_stream/<stream_name>/')
def single_stream(stream_name):
    render_args = {
        "stream_name": stream_name,
    }
    return render_template('single_stream.html', **render_args) 

# A test func for the PV Lists this translates the page made by bill to the Minargon webpage
# and also updates the script to be more compatible with python
@app.route('/<connection>/test_pv')
def test_pv(connection):
    return render_template('test_pvs.html', data=postgres_api.test_pv_internal(connection))

# ICARUS VST TEMPORARY HACK: hardcode which link function to use to TPC
def timeseries_view(args, instance_name, view_ident="", link_function="wireLink"):
    # TODO: what to do with this?
    initial_datum = args.get('data', None)
    
    # get the config for this group from redis
    config = online_metrics.get_group_config(instance_name)

    if initial_datum is None:
        if len(config["metric_list"]) > 0:
            initial_datum = config["metric_list"][0]
        else:
            intial_datum = "rms"

    render_args = {
        'title': instance_name,
        'link_function': link_function,
        'view_ident': view_ident,
        'config': config,
        'metric': initial_datum
    }

    return render_template('timeseries.html', **render_args)

@app.route('/power_supply_single_stream/<database>/<ID>')
def power_supply_single_stream(database, ID):
    # get the config
    config = postgres_api.pv_meta_internal(database, ID)
    # print config
    render_args = {
      "ID": ID,
      "config": config,
      "database": database,
    }
    return render_template('power_supply_single_stream.html', **render_args)

# snapshot of data on channel (fft and waveform)
@app.route('/channel_snapshot')
def channel_snapshot():
    channel = request.args.get('channel', 0, type=int)

    view_ind = {'channel': channel}
    # TODOL fix..... all of this
    view_ind_opts = {'channel': range(576)}

    instance_name = "tpc_channel"
    config = online_metrics.get_group_config(instance_name)

    template_args = {
        'channel': channel,
        'config': config,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
    }
    return render_template('channel_snapshot.html', **template_args)

