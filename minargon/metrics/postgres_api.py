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

	t_interval = abs(stop_t - start_t) # Absolute value to fix stream args giving a negative value

	# Database query to execute, times converted to unix [ms]
	if (database == "SBNTESTSTAND"):
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,FLOAT_VAL AS VALUE
			FROM SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME;""" % ( ID, t_interval )
	
	else:
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,NUM_VAL AS VALUE,FLOAT_VAL
			FROM DCS_PRD.SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME"""% ( ID, t_interval )

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
@app.route("/power_supply_step/<ID>")
def power_supply_step(ID):

	# Define time to request for the postgres database
	start_t = datetime.now() - timedelta(days=2)    # Start time
	stop_t  = datetime.now()    					# Stop time

	data = postgres_query(ID, start_t, stop_t)

	# Get the sample size from last two values in query
	try:
		step_size = data[len(data) - 1]['sample_time'] - data[len(data) - 2]['sample_time'] 
	except:
		print "Error in step size"

	# Catch for if no step size exists
	if (step_size == None):
		step_size = 1e3

	return jsonify(step=step_size)


@app.route("/power_supply_series/<ID>")
def power_supply_series(ID):
    
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

	data = postgres_query(ID, start_t, stop_t)

	# Format the data from database query
	data_list = []
	for row in data:
	
		# Block works for Icarus
		if (row['value'] == None):
			row['value'] = row['float_val']
			if (row['float_val'] == None):
				row['value'] = 0
		elif (row['sample_time'] == None):
			row['sample_time'] = 0
		
		data_list.append( [ row['sample_time'], row['value'] ] )

	# Setup thes return dictionary
	ret = {
		ID: data_list
	}

	return jsonify(values=ret)
