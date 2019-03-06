#!/usr/bin/env python
"""
########################################
This script will connect to a database,
execute a database query and then convert
this query into a json format
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
	# Connect to the database
	connection = psycopg2.connect(database=database_name, user=u, password=p, host=host, port=port)
	# store it
	p_databases[connection_name] = (connection, config)

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

# Make the DB query and return the data
def postgres_query(ID, start_t, stop_t, connection, config):
	# return nothing if no connection
	if connection is None:
		return []
	
	# Make PostgresDB connection
	cursor = connection.cursor(cursor_factory=RealDictCursor) 

	t_interval = abs(stop_t - start_t) # Absolute value to fix stream args giving a negative value

	# Database query to execute, times converted to unix [ms]
	if (config["name"] == "sbnteststand"):
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,FLOAT_VAL AS VALUE, FLOAT_VAL
			FROM DCS_ARCHIVER.SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME;""" % ( ID, t_interval / 1000.)
	
	else:
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,NUM_VAL AS VALUE,FLOAT_VAL
			FROM DCS_PRD.SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME"""% ( ID, t_interval / 1000. )

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


# Gets the sample step size in unix miliseconds
@app.route("/<connection>/ps_step/<ID>")
@postgres_route
def ps_step(connection, ID):

	# Define time to request for the postgres database
	start_t = datetime.now() - timedelta(days=2)    # Start time
	stop_t  = datetime.now()    					# Stop time

	start_t = calendar.timegm(start_t.timetuple()) *1e3 + start_t.microsecond/1e3 # convert to unix ms
	stop_t = calendar.timegm(stop_t.timetuple()) *1e3 + stop_t.microsecond/1e3 

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


@app.route("/<connection>/ps_series/<ID>")
@postgres_route
def ps_series(connection, ID):
	
	# Make a request for time range
	args = stream_args(request.args)
	start_t = args['start']    # Start time
	stop_t  = args['stop']     # Stop time

	# Catch for if no stop time exists
	if (start_t == None): 
		now = datetime.now() - timedelta(days=2)  # time 2 days ago
		start_t = calendar.timegm(now.timetuple()) *1e3 + now.microsecond/1e3 # convert to unix ms

	# Catch for if no stop time exists
	if (stop_t == None): 
		now = datetime.now() # time now
		stop_t = calendar.timegm(now.timetuple()) *1e3 + now.microsecond/1e3 # convert to unix ms

	data = postgres_query(ID, start_t, stop_t, *connection)

	# Format the data from database query
	data_list = []
	for row in data:
	
		# Block for switching between values in ICARUS DB,
		# shouldnt affect the sbnteststand database
		if (row['value'] == None):
			row['value'] = row['float_val']
			
			if (row['float_val'] == None):
				row['value'] = 0
		
		elif (row['sample_time'] == None):
			row['sample_time'] = 0 # probably not the best way of setting the sample time

		# Add the data to the list
		data_list.append( [ row['sample_time'], row['value'] ] )

	# If the data is empty, just return the time now and a zero
	if not data_list:
		data_list.append([calendar.timegm(datetime.now().timetuple()) *1e3 + datetime.now().microsecond/1e3,0] )

	# Setup thes return dictionary
	ret = {
		ID: data_list
	}

	return jsonify(values=ret)

# A test func for the PV Lists this translates the page made by bill to the Minargon webpage
# and also updates the script to be more compatible with python
@app.route('/<connection>/test_pv')
@postgres_route
def test_pv(connection):

	database = connection[1]["name"]
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
			pydict["nodes"][index[0] - 1 ]["nodes"].append( {"href":"#child","expanded": "false","tags":[str(tags[1])], "text" : str(row[1]), "nodes": []  } ) # Level 2
			index[1] = index[1] + 1
			tags[0] = tags[0] + 1
			old[1] = row[1]

		# Push back every time       
		pydict["nodes"][index[0] - 1 ]["nodes"][index[1] - 1]["nodes"].append( {"text" : str(row[2]), "tags" : [str(tags[1])] , "href" : "/cgi-bin/minargon/minargon.wsgi/power_supply_single_stream/"+str(row[3]) }) # Level 3
		index[2] = index[2] + 1
		tags[1] = tags[1] + 1

	data = json.dumps(pydict) # convert python dictonary to json format

	return render_template('test_pvs.html', data=data)
 


