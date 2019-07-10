#!/usr/bin/env python
"""
########################################
This script contains all the functions
used to access the PostgreSQL database
and useful helper functions related to
this.
########################################
"""

import os
import subprocess 
import psycopg2
import json
from psycopg2.extras import RealDictCursor
from minargon.tools import parseiso, parseiso_or_int, stream_args
from minargon import app
from flask import jsonify, request, render_template, abort
from datetime import datetime, timedelta # needed for testing only
import time
import calendar
from pytz import timezone
#________________________________________________________________________________________________
# database connection configuration
postgres_instances = app.config["POSTGRES_INSTANCES"]
# storing different connections to be accessed by routes
p_databases = {}

# get the connections from the config
for connection_name, config in postgres_instances.items():
	key = config["epics_secret_key"]
	database_name = config["name"]
	host = config["host"]
	port = config["port"]
	with open(key) as f:
		u = (f.readline()).strip() # strip: removes leading and trailing chars
		p = (f.readline()).strip()
	
        config["web_name"] = connection_name
	# Connect to the database
	connection = psycopg2.connect(database=database_name, user=u, password=p, host=host, port=port)
	
	# store it
	p_databases[connection_name] = (connection, config)
#________________________________________________________________________________________________
# decorator for getting the correct database from the provided link
def postgres_route(func):
	from functools import wraps
	@wraps(func)
	def wrapper(connection, *args, **kwargs):
		if connection in p_databases:
			connection = p_databases[connection]
			return func(connection, *args, **kwargs)
		else:
			return abort(404)
		
	return wrapper
#________________________________________________________________________________________________
# Make the DB query and return the data
def postgres_query(ID, start_t, stop_t, connection, config):
	# return nothing if no connection
	if connection is None:
		return []
	
	# Make PostgresDB connection
	cursor = connection.cursor(cursor_factory=RealDictCursor) 

	# Database query to execute, times converted to unix [ms]
	if (config["name"] == "sbnteststand"):
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,FLOAT_VAL AS VALUE, FLOAT_VAL
			FROM DCS_ARCHIVER.SAMPLE WHERE CHANNEL_ID=%s AND SMPL_TIME BETWEEN to_timestamp(%s) AND to_timestamp(%s) ORDER BY SAMPLE_TIME"""% ( ID , start_t / 1000., stop_t / 1000. )
	
	else:
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME, NUM_VAL AS VALUE, FLOAT_VAL
			FROM DCS_PRD.SAMPLE WHERE CHANNEL_ID=%s AND SMPL_TIME BETWEEN to_timestamp(%s) AND to_timestamp(%s) ORDER BY SAMPLE_TIME"""% ( ID , start_t / 1000., stop_t / 1000. )
	
	# Execute query, rollback connection if it fails
	try:
		cursor.execute(query)
		data = cursor.fetchall()
	except:
		print "Error! Rolling back connection"
		cursor.execute("ROLLBACK")
		connection.commit()
		data = []

	return data

#________________________________________________________________________________________________
# Gets the sample step size in unix miliseconds
@app.route("/<connection>/ps_step/<ID>")
@postgres_route
def ps_step(connection, ID):
	# Define time to request for the postgres database
	start_t = datetime.now(timezone('UTC')) - timedelta(days=1)  # Start time
	stop_t  = datetime.now(timezone('UTC'))    	                 # Stop time

	start_t = calendar.timegm(start_t.timetuple()) *1e3 + start_t.microsecond/1e3 # convert to unix ms
	stop_t  = calendar.timegm(stop_t.timetuple())  *1e3 + stop_t.microsecond/1e3 

	data = postgres_query(ID, start_t, stop_t, *connection)

	# Predeclare variable otherwise it will complain the variable doesnt exist 
	step_size = None

	# Get the sample size from last two values in query
	try:
		step_size = data[len(data) - 1]['sample_time'] - data[len(data) - 2]['sample_time'] 
	except:
		print "Error in step size"

	# Catch for if no step size exists
	if (step_size == None):
		step_size = 1e3

	return jsonify(step=step_size)
#________________________________________________________________________________________________
# Function to check None Values and empty unit
def CheckVal(var):
	if var == None or var == " ":
		return True
	else:
		return False
#________________________________________________________________________________________________
# Function to get the metadata for the PV
@app.route("/<connection>/pv_meta/<ID>")
def pv_meta(connection, ID):
	return jsonify(metadata=pv_meta_internal(connection, ID))
#________________________________________________________________________________________________
@postgres_route
def pv_meta_internal(connection, ID):
	
	database = connection[1]["name"]
	connection = connection[0]

	# return nothing if no connection
	if connection is None:
		return {}
	
	# Make PostgresDB connection
	cursor = connection.cursor(cursor_factory=RealDictCursor) 

	# Only implemented for Icarus epics right now
	query="""SELECT low_disp_rng, high_disp_rng, low_warn_lmt, high_warn_lmt, low_alarm_lmt, high_alarm_lmt, unit, SPLIT_PART(DCS_PRD.CHANNEL.NAME,'/',1) AS title, SPLIT_PART(DCS_PRD.CHANNEL.NAME,'/',2) AS y_title
	FROM DCS_PRD.num_metadata, DCS_PRD.CHANNEL
	WHERE DCS_PRD.CHANNEL.CHANNEL_ID=%s AND DCS_PRD.num_metadata.CHANNEL_ID=%s """ % (ID, ID)

	# Execute query, rollback connection if it fails
	try:
		cursor.execute(query)
		data = cursor.fetchall()
	except:
		print "Error! Rolling back connection"
		cursor.execute("ROLLBACK")
		connection.commit()
		data = []
	
	# Format the data from database query
	ret = {}
	warningRange = []
	DispRange = []
	for row in data:
		warningRange.append(row['low_warn_lmt'])
		warningRange.append(row['high_warn_lmt'])
		DispRange.append(row['low_disp_rng'])
		DispRange.append(row['high_disp_rng'])

		# Add the data to the list only if it has a value andlow != high otherwise just give empty
		
		# Unit
		if CheckVal(row['unit']) == False:
			ret["unit"] = row["unit"]

		# y Title	
		ret["yTitle"] = row['y_title']
		
		# Title
		ret["title"] = row["title"]
		
		# Display Range
		if (CheckVal(row['low_disp_rng']) == False and CheckVal(row['high_disp_rng']) == False) and row['low_disp_rng'] != row['high_disp_rng']:
			ret["range"] = DispRange
		
		# Warning Range
		if  (CheckVal(row['low_warn_lmt']) == False and CheckVal(row['high_warn_lmt']) == False) and row['low_warn_lmt'] != row['high_warn_lmt']:
			ret["warningRange"] = warningRange

		# only take the first row of data -- there should really only be one configuration per id
		break

	# Setup the return dictionary
	return ret
#________________________________________________________________________________________________
@app.route("/<connection>/ps_series/<ID>")
@postgres_route
def ps_series(connection, ID):
	
	# Make a request for time range
	args = stream_args(request.args)
	start_t = args['start']    # Start time
	stop_t  = args['stop']     # Stop time

	# Catch for if no stop time exists
	if (stop_t == None): 
		now = datetime.now(timezone('UTC')) # Get the time now in UTC
		stop_t = calendar.timegm(now.timetuple()) *1e3 + now.microsecond/1e3 # convert to unix ms

	data = postgres_query(ID, start_t, stop_t, *connection)

	# Format the data from database query
	data_list = []

	for row in data:
	
		# Switch between value and float value, if both null then skip
		if (row['value'] == None):
			row['value'] = row['float_val']
		
		# skip null values
		if (row['float_val'] == None):
			continue 
		
		# Throw out values > 1e30 which seem to be an error
		if (row['value'] > 1e30):
			continue

		# Add the data to the list
		data_list.append( [ row['sample_time'], row['value'] ] )
	
	# Setup the return dictionary
	ret = {
		ID: data_list
	}

	return jsonify(values=ret)
#________________________________________________________________________________________________
@postgres_route
def pv_internal(connection, link_name=None, ret_id=None):
	config = connection[1]
	database = connection[1]["name"]
	config = connection[1]
	connection = connection[0]

	# Cursor allows python to execute a postgres command in the database session. 
	cursor = connection.cursor() # Fancy way of using cursor

	# Database command to execute
	if (database == "sbnteststand"):
		query="""
		SELECT DCS_ARCHIVER.CHAN_GRP.NAME, SPLIT_PART(DCS_ARCHIVER.CHANNEL.NAME,'/',1), SPLIT_PART(DCS_ARCHIVER.CHANNEL.NAME,'/',2), DCS_ARCHIVER.CHANNEL.CHANNEL_ID
		FROM DCS_ARCHIVER.CHANNEL, DCS_ARCHIVER.CHAN_GRP
		WHERE DCS_ARCHIVER.CHANNEL.GRP_ID = DCS_ARCHIVER.CHAN_GRP.GRP_ID 
		ORDER BY DCS_ARCHIVER.CHAN_GRP.NAME, DCS_ARCHIVER.CHANNEL.NAME;
		"""
	else:
		query="""
		SELECT DCS_PRD.CHAN_GRP.NAME,SPLIT_PART(DCS_PRD.CHANNEL.NAME,'/',1),
		SPLIT_PART(DCS_PRD.CHANNEL.NAME,'/',2),DCS_PRD.CHANNEL.CHANNEL_ID
		FROM DCS_PRD.CHANNEL,DCS_PRD.CHAN_GRP WHERE DCS_PRD.CHANNEL.GRP_ID=DCS_PRD.CHAN_GRP.GRP_ID 
		ORDER BY DCS_PRD.CHAN_GRP.NAME,DCS_PRD.CHANNEL.NAME;
		"""
	cursor.execute(query)

	rows = cursor.fetchall()

	# some variables for bookkeeping
	old = [" ", " ", " "]
	tags = [0, 0, 0]
	index = [ 0, 0, 0 ]

	# Top level pydict
	if (database == "sbnteststand"):
		pydict =	{ 
			"text" : ["SBN Test Stand Process Variables"],
			"expanded": "true",
			"nodes" : []
		}
	else: # ICARUS
		pydict =	{ 
			"text" : ["ICARUS Process Variables"],
			"expanded": "true",
			"nodes" : []
		}

	# A list of id numbers for a variable
	list_id=[]
	id_flag=False 

	# Create a python dictonary out of the database query
	for row in rows:
		# Header 1
		if row[0] != old[0]: # only use chan name part 1 once in loop to avoid overcounting e.g. grab APC then skip block until CRYO
			tags[0] = 0
			tags[1] = 0
			pydict["nodes"].append( {"expanded": "false", "text" : str(row[0]), "href": "#parent1","nodes" : [], "tags": [str(tags[0])]} ) # Top Level 
			old[0] = row[0]         
			index[0] = index[0] + 1 # Increment the index
			index[1] = 0

		# Header 2
		if row[1] != old[1]: # only use chan name part 2 once in loop to avoid overcounting 
			tags[1] = 0
			pydict["nodes"][index[0] - 1 ]["nodes"].append( {"href":"#child","expanded": "false","tags":[str(tags[1])],
				"text" : str(row[1]), "nodes": [], "href": app.config["WEB_ROOT"] + "/" + "pv_multiple_stream" + "/" + config["web_name"] + "/" + str(row[1])  } ) # Level 2
			index[1] = index[1] + 1
			tags[0] = tags[0] + 1
			old[1] = row[1]			
		
		# the "timestamp column does not correspond to a metric
		if str(row[2]) == "timestamp": continue

		# Append the ID numbers for selected variable name
		if row[1] == ret_id:
			list_id.append(str(row[3]))


		# Push back every time
		if not link_name is None:
			pydict["nodes"][index[0] - 1 ]["nodes"][index[1] - 1]["nodes"].append( {"text" : str(row[2]), "tags" : [str(tags[1])],
				"database": config["web_name"], "ID": str(row[3]), "name": str(row[2]), "href": app.config["WEB_ROOT"] + "/" + link_name + "/" + config["web_name"] + "/" + str(row[3])  }) # Level 3
		else: 
			pydict["nodes"][index[0] - 1 ]["nodes"][index[1] - 1]["nodes"].append( {"text" : str(row[2]), "tags" : [str(tags[1])],
				"database": config["web_name"], "ID": str(row[3]), "name": str(row[2])  }) # Level 3
		
		index[2] = index[2] + 1
		tags[1] = tags[1] + 1
	
	# Decide what type of data to return
	if ret_id is None:
		return pydict # return the full tree
	else:
		return list_id # return the ids of a variable
#________________________________________________________________________________________________