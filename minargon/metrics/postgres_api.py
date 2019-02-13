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
    with open(app.config["EPICS_SECRET_KEY"],"r") as f:
       u = (file.readline()).strip() # strip: removes leading and trailing chars
       p = (file.readline()).strip()
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
	if (config["name"] == "SBNTESTSTAND"):
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
@app.route("/<connection>/ps_step/<ID>")
@postgres_route
def ps_step(connection, ID):

	# Define time to request for the postgres database
	start_t = datetime.now() - timedelta(days=2)    # Start time
	stop_t  = datetime.now()    					# Stop time

	data = postgres_query(ID, start_t, stop_t, *connection)

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
