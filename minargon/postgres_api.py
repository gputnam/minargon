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

database = app.config["DATABASE"]

# Read in file with user(u) and password(p)
if (database == "SBNTESTSTAND"):
	print "Using SBNTESTSTAND DB"
	file = open(app.config["EPICS_SECRET_KEY"],"r") 
	u = (file.readline()).strip(); # strip: removes leading and trailing chars
	p = (file.readline()).strip()
	file.close()

	# Connect to the database
	connection = psycopg2.connect(database=app.config["SBNTESTSTAND_DB"], user=u, 
		password=p,host=app.config["SBNTESTSTAND_HOST"], port=app.config["SBNTESTSTAND_PORT"])

	app.config["SBNTESTSTAND_HOST"]
else:
	print "Using ICARUS DCS DB"
	file = open(app.config["ICARUS_DCS_SECRET_KEY"],"r") 
	u = (file.readline()).strip(); # strip: removes leading and trailing chars
	p = (file.readline()).strip()
	file.close()

	# Connect to the database
	connection = psycopg2.connect(database=app.config["ICARUS_DCS_DB"], user=u, 
		password=p,host=app.config["ICARUS_DCS_HOST"], port=app.config["ICARUS_DCS_PORT"])

	app.config["ICARUS_DCS_HOST"]


# Make the DB query and return the data
def postgres_query(ID):
	
	# Make PostgresDB connection
	cursor = connection.cursor(cursor_factory=RealDictCursor) 

	# Make a request for time range to plot
	args = stream_args(request.args)
	start_t = args['start']    # Start time
	stop_t  = args['stop']     # Stop time

	# Placeholder datetimes to be removed once working
	# start_t = datetime.now()                         # Start time
	# stop_t  = datetime.now() + timedelta(days=2)     # Stop time

	t_interval = stop_t - start_t

	# Database query to execute, times converted to unix [ms]
	if (database == "SBNTESTSTAND"):
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,FLOAT_VAL AS VALUE
			FROM SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME;""" % ( ID, t_interval )
	
	else:
		query="""SELECT extract(epoch from SMPL_TIME)*1000 AS SAMPLE_TIME,FLOAT_VAL,NUM_VAL
			FROM DCS_PRD.SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME"""% ( ID, t_interval )

	cursor.execute(query)

	# Grab the data
	data = cursor.fetchall()

	return data


# Gets the sample step size in unix miliseconds
@app.route("/power_supply_step/<ID>")
def power_supply_step(ID):
	
	data = postgres_query(ID)

	# Get the sample size from last two values in query
	step_size = data[len(data) - 1]['sample_time'] - data[len(data) - 2]['sample_time'] 

	return jsonify(step=step_size)


@app.route("/power_supply_series/<ID>")
def power_supply_series(ID):
    
	data = postgres_query(ID)

	# setup the return dictionary
	ret = { ID: data }

	return jsonify(values=ret)


