from __future__ import absolute_import
from minargon import app
from flask import render_template, jsonify, request, redirect, url_for, flash
import json
from minargon.metrics import postgres_api

from minargon.tools import parseiso
from minargon.metrics import online_metrics
from minargon.views.common.views import timeseries_view

from minargon import hardwaredb

# load template injectors
from . import inject
from six.moves import range
from six.moves import zip

@app.route('/test/<int:chan>')
def test(chan):
    channels =  hardwaredb.icarus_tpc.tpc_channel_list("readout_board_id", str(chan))
    return str(channels)

@app.route('/TPC_Flange_Overview/<TPC>')
def TPC_Flange_Overview(TPC):
    flanges = hardwaredb.select(hardwaredb.HWSelector("flanges_flanges", "tpc_id", TPC))
    return flange_page(flanges)

@app.route('/Flange_Overview')
def Flange_Overview():
    flanges = ["WE05", "WE06", "WE07", "WE09", "WE18", "WE19"]
    return flange_page(flanges)

def flange_page(flanges):
    instance_name = "tpc_channel"

    config = online_metrics.get_group_config("online", instance_name, front_end_abort=True)

    # turn the flange positions to hw_selects
    hw_selects = [hardwaredb.HWSelector("flanges", "flange_pos_at_chimney", f) for f in flanges]

    channels = [hardwaredb.select(hw_select) for hw_select in hw_selects]
    channel_map = [hardwaredb.channel_map(hw_select, c) for hw_select,c in zip(hw_selects, channels)]

    # setup the plot titles
    titles = ["flange_pos_at_chimney %s -- tpc_channel" % f for f in flanges]
     
    render_args = {
      "config": config,
      "channels": channels,
      "channel_maps": channel_map,
      "flanges": flanges,
      "metric": "rms",
      "titles": titles,
      "hw_selects": [h for h in hw_selects],
      "eventmeta_key": "eventmetaTPC",
    }

    return render_template('icarus/flange_overview.html', **render_args)

@app.route('/TPC')
@app.route('/TPC/<hw_selector:hw_select>')
def TPC(hw_select=None):
    args = dict(**request.args)
    args["data"] = "rms"
    args["stream"] = "fast"

    return timeseries_view(args, "tpc_channel", "", "wireLink", eventmeta_key="eventmetaTPC", hw_select=hw_select)

@app.route('/TPC_group_select')
def TPC_group_select():
    pydict = { 
        "text" : ["Select TPC Grouping"],
        "expanded": "true",
        "color" : "#000000",
        "selectable" : "false",
        "displayCheckbox": False,
        "nodes" : []
    }

    for table, cols in hardwaredb.icarus.tpc.available_selectors().items():
        col_nodes = []
        for col, values in cols.items():
            child_nodes = []
            for opt in values:
                node = {
                    "text" : [opt.value],
                    "selectable" : "true",
                    "displayCheckbox": "false",
                    "href":  url_for("TPC", hw_select=opt)
                }
                child_nodes.append(node)

            col_node = {
                "text" : [col],
                "selectable" : "false",
                "displayCheckbox": False,
                "nodes" : child_nodes 
            }
            col_nodes.append(col_node)

        table_node = {
            "text": [table],
            "selectable" : "false",
            "displayCheckbox": False,
            "nodes" : col_nodes 
        }

        pydict["nodes"].append(table_node)

    return render_template('icarus/tpc_grouping_select.html', data=pydict)

@app.route('/NoiseCorr')
def NoiseCorr():
    return render_template("icarus/noise_snapshot.html")

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
    pmt_range = list(range(360))
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
    view_ind_opts = {'board_no': list(range(8))}

    # TODO: implement real channel mapping
    board_channels = list(range(board_no*32, (board_no+1)*32))

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
    view_ind_opts = {'channel': list(range(2304))}

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

@app.route('/TPCPS')
def tpcps():
    channel = reqeust.args.get('tpcps', 0, type=int)
    config = online_metrics.get_group_config("online", "tpcps", front_end_abort=True)
    
    render_args = {
        'channel': channel,
        'config': config,
    }

    return render_template('icarus/tpcps.html', **render_args)

  @app.route('/Impedence_Ground_Monitor')
def Impedence_Ground_Monitor():
    database = "epics"
    IDs = [44, 46, 47, 48, 49, 51, 52, 53] 

    configs = {}
    for i in IDs:
      configs[i] = postgres_api.pv_meta_internal(database, i, front_end_abort=True)

    render_args = {
      "configs": configs,
      "database": database
    }
    return render_template('icarus/impedence_ground_monitor.html', **render_args)

