from minargon import app
from flask import render_template, jsonify, request, redirect, url_for, flash
from minargon.metrics import postgres_api

from minargon.tools import parseiso, RedisDataStream, PostgresDataStream
from minargon.metrics import online_metrics
import os.path
from datetime import date, datetime

"""
	Routes intented to be seen by the user	
"""

@app.route('/test_error')
def test_error():
    sys.stderr.write("Flask error logging test")
    raise Exception("Flask exception logging test")

@app.route('/hellooo')
def hellooo():
    return 'Hellooooooo!'

@app.route('/')
def index():
    return redirect(url_for('introduction'))

@app.route('/introduction')
def introduction():
    template = os.path.join(app.config["FRONT_END"], 'introduction.html')
    return render_template(template)

@app.route('/<connection>/latest_gps_info')
def latest_gps_info(connection):
    dbrows = postgres_api.get_gps(connection, front_end_abort=True)     

    return render_template('common/gps_info.html',rows=dbrows)


@app.route('/online_group/<group_name>')
def online_group(group_name):
    return timeseries_view(request.args, group_name)

@app.route('/single_stream/<stream_name>/')
def single_stream(stream_name):
    render_args = {
        "stream_name": stream_name,
    }
    return render_template('common/single_stream.html', **render_args) 

# A test func for the PV Lists this translates the page made by bill to the Minargon webpage
# and also updates the script to be more compatible with python
@app.route('/<connection>/pvTree')
def pvTree(connection):
    return render_template('common/pvTree.html', data=postgres_api.pv_internal(connection, "pv_single_stream", front_end_abort=True))

def timeseries_view(args, instance_name, view_ident="", link_function="undefined"):
    # TODO: what to do with this?
    initial_datum = args.get('data', None)
    
    # get the config for this group from redis
    config = online_metrics.get_group_config("online", instance_name, front_end_abort=True)

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

    return render_template('common/timeseries.html', **render_args)

@app.route('/pv_single_stream/<database>/<ID>')
def pv_single_stream(database, ID):
    # get the config
    config = postgres_api.pv_meta_internal(database, ID, front_end_abort=True)
    # get the list of other data
    # tree = postgres_api.test_pv_internal(database)

    # check the currently visited item
    checked = [("postgres", database, str(ID))]
    tree = build_data_browser_tree(checked)
    # print config
   
    #low and high thresholds given by url parameters 
    low = request.args.get('low')
    high = request.args.get('high')
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
	start_timestamp_int = parseiso(start_time);

    else:
	start_obj = None
	start_time = start
        start_timestamp_int = None
 
    end = request.args.get('end')
    if end is not None:
	end_obj = datetime.strptime(end, '%m-%d-%Y_%H:%M')
	#end time string to be placed in date picker
	end_time = datetime.strftime(end_obj, '%m/%d/%Y %H:%M')
        #%m%d%y%H:%M format to convert string into integer|mmddyyyyHHMM

	#end timestamp to update plot
	end_timestamp_int = parseiso(end_time);

    else:
	end_obj = None
        end_time = end
        end_timestamp_int = None

    render_args = {
      "ID": ID,
      "config": config,
      "database": database,
      "tree": tree,
      "low": low,
      "high": high,
      "start_time": start_time,
      "end_time": end_time,
      "start_timestamp": start_timestamp_int,
      "end_timestamp": end_timestamp_int
    }
    return render_template('common/pv_single_stream.html', **render_args)

# View a variable with multiple IDs
@app.route('/pv_multiple_stream/<database>/<var>')
def pv_multiple_stream(database, var):
    
    # Get the list of IDs for the var name
    IDs = postgres_api.pv_internal(database, ret_id=var, front_end_abort=True)

    # get the configs for each ID
    configs, starts, ends, toggles, downloads = [], [], [], [], []
    for ID in IDs:
        configs.append(postgres_api.pv_meta_internal(database, ID, front_end_abort=True))
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
    return render_template('common/pv_multiple_stream.html', **render_args)


def build_data_browser_tree(checked=None):
    # get the redis instance names
    redis_names = [name for name,_ in app.config["REDIS_INSTANCES"].items()]
    # and the postgres isntance names
    postgres_names = [name for name in app.config["EPICS_INSTANCES"]]
    # build all of the trees
    trees = [postgres_api.pv_internal(name, front_end_abort=True) for name in postgres_names if postgres_api.is_valid_connection(name)] \
        + [online_metrics.build_link_tree(name, front_end_abort=True) for name in redis_names]

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

@app.route('/view_correlation/<stream:streamX>/<stream:streamY>')
def view_correlation(streamX, streamY):
    if isinstance(streamX, PostgresDataStream):
        streamXarg = "postgres_" + streamX.name + "=" + str(streamX.ID)
    else:
        streamXarg = "redis_" + streamX.name + "=" + str(streamX.key)

    if isinstance(streamY, PostgresDataStream):
        streamYarg = "postgres_" + streamY.name + "=" + str(streamY.ID)
    else:
        streamYarg = "redis_" + streamY.name + "=" + str(streamY.key)
 

    render_args = {
      "streamX": streamX.to_config(),
      "streamY": streamY.to_config(),
      "urlStreamX": streamX,
      "urlStreamY": streamY,
      "streamXarg": streamXarg,
      "streamYarg": streamYarg
    }
    return render_template("common/view_correlation.html", **render_args)

@app.route('/view_streams')
def view_streams():
    postgres_stream_info = {}
    redis_stream_info = {}
    # parse GET parameters
    try:
        for arg, val in request.args.items(multi=True):
            # postgres streams
            if arg.startswith("postgres_"):
                database_name = arg[9:]
                database_ids = [int(x) for x in val.split(",") if x]
                if database_name not in postgres_stream_info:
                    postgres_stream_info[database_name] = database_ids
                else:
                    postgres_stream_info[database_name] += database_ids
            # redis streams
            elif arg.startswith("redis_"):
                database_name = arg[6:]
                database_keys = val.split(",")
                if database_name not in redis_stream_info:
                    redis_stream_info[database_name] = database_keys
                else:
                    redis_stream_info[database_name] += database_keys
            else:
               raise ValueError
    except:
        return abort(404)

    postgres_streams = []
    redis_streams = []
    # collect configuration for postgres streams
    for database, IDs in postgres_stream_info.items():
        for ID in IDs:
            config = postgres_api.pv_meta_internal(database, ID, front_end_abort=True)
            postgres_streams.append( (ID, database, config) )
    # TODO: collect redis stream configuration
    for database, keys in redis_stream_info.items():
        for key in keys:
            try:
                metric_name = key.split(":")[-2]
            except:
                metric_name = key
            config = {
              "title": key,
              "yTitle": metric_name 
            }
            redis_streams.append( (key, database, config) )

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

    # functions to build the "Stream" object from the config
    def make_redis_stream(info):
      key, database, _ = info
      return RedisDataStream(database, key)
    def make_postgres_stream(info):
      ID, database, _ = info
      return PostgresDataStream(database, ID)

    render_args = {
      "tree": tree,
      "redis_streams": redis_streams,
      "postgres_streams": postgres_streams,
      "make_redis_stream": make_redis_stream,
      "make_postgres_stream": make_postgres_stream
    }
    return render_template("common/view_streams.html", **render_args)

