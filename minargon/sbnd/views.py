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

from minargon.tools import parseiso
# from minargon.data_config import parse
from minargon.metrics import online_metrics

# load data configuration file
# DATA_CONFIG = parse.DataParser(app.config).config

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

# A test func for the PV Lists this translates the page made by bill to the Minargon webpage
# and also updates the script to be more compatible with python
@app.route('/<connection>/pvTree')
def pvTree(connection):
    return render_template('pvTree.html', data=postgres_api.pv_internal(connection, "pv_single_stream"))

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

    instance_name = "wireplane"
    config = online_metrics.get_group_config(instance_name)

    template_args = {
        'channel': channel,
        'config': config,
        'view_ind': view_ind,
        'view_ind_opts': view_ind_opts,
    }
    return render_template('channel_snapshot.html', **template_args)

# view of a number of wires on a wireplane
@app.route('/wireplane_view')
def wireplane_view():
    plane = request.args.get('plane', 'combined')
    instance_name = "tpc_channel" 
    return timeseries_view(request.args, instance_name, "wire", "wireLink")

@app.route('/pv_single_stream/<database>/<ID>')
def pv_single_stream(database, ID):
    # get the config
    config = postgres_api.pv_meta_internal(database, ID)
    # get the list of other data
    # tree = postgres_api.test_pv_internal(database)

    # check the currently visited item
    checked = [("postgres", database, str(ID))]
    tree = build_data_browser_tree(checked)
    # print config
    render_args = {
      "ID": ID,
      "config": config,
      "database": database,
      "tree": tree
    }
    return render_template('pv_single_stream.html', **render_args)

# View a variable with multiple IDs
@app.route('/pv_multiple_stream/<database>/<var>')
def pv_multiple_stream(database, var):
    
    # Get the list of IDs for the var name
    IDs = postgres_api.pv_internal(database, ret_id=var)

    # get the configs for each ID
    configs, starts, ends, toggles, downloads = [], [], [], [], []
    for ID in IDs:
        configs.append(postgres_api.pv_meta_internal(database, ID))
        starts.append("start-"+str(ID))
        ends.append("end-"+str(ID))
        toggles.append("toggle-"+str(ID))
        downloads.append("download-"+str(ID))

    # print config
    render_args = {
      "var": var, 
      "IDs": IDs,
      "configs": configs,
      "starts" : starts,
      "ends" : ends,
      "toggles" : toggles,
      "downloads" : downloads,
      "database": database
    }
    return render_template('pv_multiple_stream.html', **render_args)


def build_data_browser_tree(checked=None):
    # get the redis instance names
    redis_names = [name for name,_ in app.config["REDIS_INSTANCES"].items()]
    # and the postgres isntance names
    postgres_names = [name for name,_ in app.config["POSTGRES_INSTANCES"].items()]
    # build all of the trees
    trees = [postgres_api.pv_internal(name) for name in postgres_names] + [online_metrics.build_link_tree(name) for name in redis_names]
    # wrap them up at a top level
    tree_dict = {
      "text": "Data Browser",
      "expanded": True,
      "nodes": trees,
      "displayCheckbox": False,
    }
    # pre-check some instances
    if checked is None:
        checked = []
    for c in checked:
        database_type, database, ID = c
        # do a DFS down the nodes
        stack = [tree_dict]
        while len(stack) > 0:
            vertex = stack.pop()
            if "nodes" in vertex:
                stack = stack + vertex["nodes"]
            elif "ID" in vertex and "database" in vertex and "database_type" in vertex:
                if vertex["ID"] == ID and vertex["database"] == database and vertex["database_type"] == database_type:
                    vertex["state"] = {"checked": True}
                    # if we've found the vertex, we can exit the search
                    break
    return tree_dict

@app.route('/view_streams')
def view_streams():
    postgres_stream_info = {}
    redis_stream_info = {}
    # parse GET parameters
    try:
        for arg, val in request.args.items():
            # postgres streams
            if arg.startswith("postgres_"):
                database_name = arg[9:]
                database_ids = [int(x) for x in val.split(",") if x]
                postgres_stream_info[database_name] = database_ids
            # redis streams
            elif arg.startswith("redis_"):
                database_name = arg[6:]
                database_keys = val.split(",")
                redis_stream_info[database_name] = database_keys
    except:
        return abort(404)

    postgres_streams = []
    redis_streams = []
    # collect configuration for postgres streams
    for database, IDs in postgres_stream_info.items():
        for ID in IDs:
            config = postgres_api.pv_meta_internal(database, ID)
            postgres_streams.append( (ID, database, config) )
    # TODO: collect redis stream configuration
    for database, keys in redis_stream_info.items():
        for key in keys:
            redis_streams.append( (key, database, {}) )

    checked = []
    # get the currently checked items
    for database, IDs in postgres_stream_info.items():
        for ID in IDs:
            checked.append( ("postgres", database, str(ID)) )
    for database, keys in redis_stream_info.items():
        for key in keys:
            checked.append( ("redis", database, key) )

    # build the data tree
    tree = build_data_browser_tree(checked)
    render_args = {
      "tree": tree,
      "redis_streams": redis_streams,
      "postgres_streams": postgres_streams
    }
    return render_template("view_streams.html", **render_args)

@app.route('/online_group/<group_name>')
def online_group(group_name):
    return timeseries_view(request.args, group_name)

@app.route('/single_stream/<stream_name>/')
def single_stream(stream_name):
    render_args = {
        "stream_name": stream_name,
    }
    return render_template('single_stream.html', **render_args) 

def timeseries_view(args, instance_name, view_ident="", link_function="undefined"):
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
    

@app.route('/purity')
def purity():
    config = online_metrics.get_group_config("TPC")

    render_args = {
      'config': config
    }

    return render_template('purity.html', **render_args)


