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
from minargon.metrics import postgres_api
import subprocess
from datetime import date, datetime
import re

from minargon.tools import parseiso
# from minargon.data_config import parse
from minargon.metrics import online_metrics

# load data configuration file
# DATA_CONFIG = parse.DataParser(app.config).config

"""
	Routes intended to be seen by the user	
"""

@app.route('/test_error')
def test_error():
    sys.stderr.write("Flask error logging test")
    raise Exception("Flask exception logging test")

#TODO: get custom parameters from url link
@app.route('/sample_route/')#<par1>')#methods = ['GET','POST'])
def get_args_from_url(par1 = ''):
    #return par1
    n = request.args.get('arg1')
    q = datetime.strptime('Jun 1 1970 1:30PM', '%b %d %Y %I:%M%p')
    #if n is None:
      #return 'no parameters'
    #else:
    return q

@app.route('/<connection>/latest_gps_info')
def latest_gps_info(connection):
    dbrows = postgres_api.get_gps(connection)     

    return render_template('gps_info.html',rows=dbrows)

@app.route('/hello')
def hello():
    return 'Hello!'

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
@app.route('/<connection>/test_pv')
def test_pv(connection):
    return render_template('test_pvs.html', data=postgres_api.test_pv_internal(connection, "power_supply_single_stream"))

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

@app.route('/power_supply_single_stream/<database>/<ID>')
def power_supply_single_stream(database, ID):
    # get the config
    config = postgres_api.pv_meta_internal(database, ID)
    # get the list of other data
    tree = postgres_api.test_pv_internal(database)
    # print config
   
    #low and high thresholds given by url parameters 
    low = request.args.get('low')
    high = request.args.get('high')
#    if low is None:
#	low = -400
#    if high is None:
#	high = 400
    #TODO: add try and catch cases for getting timestamps
    #Use 24 hour clock for defining time in url
    #date format from URL: Month-Day-Year_Hour:Minute | mm-dd-yr hr-min
    #date format to turn back to string: Month/Day/Year Hour:Minute
    start = request.args.get('start')
    if start is not None:
	start_obj = datetime.strptime(start, '%m-%d-%Y_%H:%M')
	#start time string to be placed in date picker
        start_time = datetime.strftime(start_obj,'%m/%d/%Y %H:%M')
        #%m%d%y%H:%M format to convert string into integer|mmddyyyyHHMM

	# start timestamp to update plot
        #start_timestamp_str = datetime.strftime(start_obj, '%m%d%y%H:%M')
	start_timestamp_int = parseiso(start_time);
	#start_timestamp_int = int(start_obj.strftime("%s"))
	#start_timestamp_int = int(re.sub(r'[^\d-]+', '',start_timestamp_str))

    else:
	start_obj = None
	start_time = start
	current_time = datetime.now() 
	#start_timestamp_int = int(current_time.strftime("%s")) - 3600
 
    end = request.args.get('end')
    if end is not None:
	end_obj = datetime.strptime(end, '%m-%d-%Y_%H:%M')
	#end time string to be placed in date picker
	end_time = datetime.strftime(end_obj, '%m/%d/%Y %H:%M')
        #%m%d%y%H:%M format to convert string into integer|mmddyyyyHHMM

	#end timestamp to update plot
        #end_timestamp_str = datetime.strftime(end_obj, '%m%d%y%H:%M')
	end_timestamp_int = parseiso(end_time);
        #end_timestamp_int = int(re.sub(r'[^\d-]+', '',end_timestamp_str))
	#end_timestamp_int = int(end_obj.strftime("%s"))

    else:
	end_obj = None
        end_time = end
	current_time = datetime.now()
	#end_timestamp_int = int(current_time.strftime("%s"))


    render_args = {
      "ID": ID,
      "config": config,
      "database": database,
      "tree": tree,
      "low": low,
      "high": high,
      "start_obj": start_obj,
      "end_obj":end_obj,
      "start_time": start_time,
      "end_time": end_time,
      "start_timestamp": start_timestamp_int,
      "end_timestamp": end_timestamp_int
    }
    
    return render_template('power_supply_single_stream.html', **render_args)

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


