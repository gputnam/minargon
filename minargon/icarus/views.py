from minargon import app
from flask import render_template, jsonify, request, redirect, url_for, flash
from minargon.metrics import postgres_api

from minargon.tools import parseiso
from minargon.metrics import online_metrics
from minargon.common.views import timeseries_view

@app.route('/NoiseCorr')
def NoiseCorr():
    return render_template("icarus/noise_snapshot.html")

@app.route('/TPC')
def TPC():
    args = dict(**request.args)
    args["data"] = "rms"
    args["stream"] = "fast"
    return timeseries_view(args, "tpc_channel", "", "wireLink")

@app.route('/PMT')
def PMT():
    args = dict(**request.args)
    args["data"] = "rms"
    args["stream"] = "fast"
    return timeseries_view(args, "PMT", "", "pmtLink")

@app.route('/PMT_snapshot')
def PMT_snapshot():
    channel = request.args.get("PMT", 0, type=int)
    group_name = "PMT"
    # TODO: fix hardcode
    pmt_range = range(360)
    config = online_metrics.get_group_config("online", group_name, front_end_abort=True)

    template_args = {
      "channel": channel,
      "config": config,
      "pmt_range": pmt_range,
      "view_ind": {"PMT": channel},
      "view_ind_opts": {"PMT": pmt_range},
    }
    return render_template("icarus/pmt_snapshot.html", **template_args)

@app.route('/CRT_board/')
def CRT_board():
    return timeseries_view(request.args, "CRT_board", "", "crtBoardLink")

@app.route('/CRT_board_snapshot/')
def CRT_board_snapshot():
    board_no = int(request.args.get("board_no", 0))
    # get the config for this group from redis
    config_board = online_metrics.get_group_config("online", "CRT_board", front_end_abort=True)
    config_channel = online_metrics.get_group_config("online", "CRT_channel", front_end_abort=True)

    view_ind = {'board_no': board_no}
    # TODOL fix..... all of this
    view_ind_opts = {'board_no': range(8)}

    # TODO: implement real channel mapping
    board_channels = range(board_no*32, (board_no+1)*32)

    render_args = {
        'title': ("CRT Board %i Snapshot" % board_no),
        'board_config': config_board,
        'channel_config': config_channel,
        'board_no': board_no,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
        'board_channels': board_channels
    }

    return render_template("icarus/crt_board_snapshot.html", **render_args)

# snapshot of data on channel (fft and waveform)
@app.route('/channel_snapshot')
def channel_snapshot():
    channel = request.args.get('channel', 0, type=int)

    view_ind = {'channel': channel}
    # TODOL fix..... all of this
    view_ind_opts = {'channel': range(2304)}

    instance_name = "tpc_channel"
    config = online_metrics.get_group_config("online", instance_name, front_end_abort=True)

    template_args = {
        'channel': channel,
        'config': config,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
    }
    return render_template('icarus/channel_snapshot.html', **template_args)


@app.route('/Purity')
def purity():
    instance_name = "TPC"
    metric_name = "purity"

    # get the config for this group from redis
    config = online_metrics.get_group_config("online", instance_name, front_end_abort=True)

    render_args = {
        'title': metric_name,
        'config': config,
    }

    return render_template('icarus/purity_timeseries.html', **render_args)
