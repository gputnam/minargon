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
from tools import parseiso, parseiso_or_int, stream_args

from . import app
from flask import jsonify, request
from datetime import datetime, timedelta # needed for testing only
import time
import calendar

database = app.config["DATABASE"]

# Only make the connection if we have a provided key
# Read in file with user(u) and password(p)
if (database == "SBNTESTSTAND"):
	print "Using SBNTESTSTAND DB"
	if "EPICS_SECRET_KEY" in app.config:
		file = open(app.config["EPICS_SECRET_KEY"],"r") 
		u = (file.readline()).strip(); # strip: removes leading and trailing chars
		p = (file.readline()).strip()
		file.close()

		# Connect to the database
		connection = psycopg2.connect(database=app.config["SBNTESTSTAND_DB"], user=u, 
			password=p,host=app.config["SBNTESTSTAND_HOST"], port=app.config["SBNTESTSTAND_PORT"])

		app.config["SBNTESTSTAND_HOST"]
	else:
		connection = None
else:
	print "Using ICARUS DCS DB"
	if "ICARUS_DCS_SECRET_KEY" in app.config:
		file = open(app.config["ICARUS_DCS_SECRET_KEY"],"r") 
		u = (file.readline()).strip(); # strip: removes leading and trailing chars
		p = (file.readline()).strip()
		file.close()

		# Connect to the database
		connection = psycopg2.connect(database=app.config["ICARUS_DCS_DB"], user=u, 
			password=p,host=app.config["ICARUS_DCS_HOST"], port=app.config["ICARUS_DCS_PORT"])

		app.config["ICARUS_DCS_HOST"]
	else:
		connection = None


# Make the DB query and return the data
def postgres_query(ID, start_t, stop_t):
	# return nothing if no connection
	if connection is None:
		return []
	
	# Make PostgresDB connection
	cursor = connection.cursor(cursor_factory=RealDictCursor) 

	t_interval = stop_t - start_t

	# Database query to execute, times converted to unix [ms]
	if (database == "SBNTESTSTAND"):
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,FLOAT_VAL AS VALUE
			FROM SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME;""" % ( ID, t_interval )
	
	else:
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,NUM_VAL AS VALUE
			FROM DCS_PRD.SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME"""% ( ID, t_interval )

	cursor.execute(query)

	# Grab the data
	data = cursor.fetchall()

	return data


# Gets the sample step size in unix miliseconds
@app.route("/power_supply_step/<ID>")
def power_supply_step(ID):

	# Define time to request for the postgres database
	start_t = datetime.now() - timedelta(days=2)    # Start time
	stop_t  = datetime.now()    					# Stop time
	
	data = postgres_query(ID, start_t, stop_t)

	# Get the sample size from last two values in query
	step_size = data[len(data) - 1]['sample_time'] - data[len(data) - 2]['sample_time'] 

	return jsonify(step=step_size)


@app.route("/power_supply_series/<ID>")
def power_supply_series(ID):
    
	# Make a request for time range
	args = stream_args(request.args)
	start_t = args['start']    # Start time
	stop_t  = args['stop']     # Stop time

	# Catch for if no stop time exits
	if (stop_t == None): 
		now = datetime.now() # time now
		stop_t = calendar.timegm(now.timetuple()) *1e3 + now.microsecond/1e3 # convert to unix ms

	data = postgres_query(ID, start_t, stop_t)

	# Format the data from database query
	data_list = []
	for row in data:
		data_list.append([row['sample_time'], row['value']])

	# Setup the return dictionary
	ret = dict(ID = data_list)

	return jsonify(ret)