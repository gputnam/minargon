from minargon import app
from flask import render_template, jsonify, request, redirect, url_for, flash
from minargon.metrics import postgres_api

from minargon.tools import parseiso
from minargon.metrics import online_metrics
from minargon.common.views import timeseries_view

@app.route('/TPC')
def TPC():
    args = dict(**request.args)
    args["data"] = "rms"
    args["stream"] = "fast"
    return timeseries_view(args, "tpc_channel", "", "wireLink")

# snapshot of data on channel (fft and waveform)
@app.route('/channel_snapshot')
def channel_snapshot():
    channel = request.args.get('channel', 0, type=int)

    view_ind = {'channel': channel}
    # TODOL fix..... all of this
    view_ind_opts = {'channel': range(576)}

    instance_name = "tpc_channel"
    config = online_metrics.get_group_config("online", instance_name)

    template_args = {
        'channel': channel,
        'config': config,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
    }
    return render_template('icarus/channel_snapshot.html', **template_args)

