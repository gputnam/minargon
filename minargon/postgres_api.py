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

# Read in file with user(u) and password(p)
file = open(app.config["EPICS_SECRET_KEY"],"r") 
u = (file.readline()).strip(); # strip: removes leading and trailing chars
p = (file.readline()).strip()
file.close()

# Connect to the database
connection = psycopg2.connect(database=app.config["POSTGRES_DB"], user=u, 
  password=p,host=app.config["POSTGRES_HOST"], port=app.config["POSTGRES_PORT"])

app.config["POSTGRES_HOST"]

# Make the DB query and return the data
def postgres_query(ID):
	
	# Make PostgresDB connection
	cursor = connection.cursor(cursor_factory=RealDictCursor) 

	# Make a request for time range to plot
	args = stream_args(request.args)
	start_t = args['start']    # Start time
	stop_t  = args['stop']     # Stop time

	# # Placeholder datetimes to be removed once working
	# start_t = datetime.now()                         # Start time
	# stop_t  = datetime.now() + timedelta(days=2)     # Stop time

	t_interval = stop_t - start_t

	# Database query to execute
	query="""SELECT SMPL_TIME AS SAMPLE_TIME,FLOAT_VAL AS VALUE
	FROM SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<('%s') ORDER BY SMPL_TIME;""" % ( ID, t_interval )

	cursor.execute(query)

	# Grab the data
	data = cursor.fetchall()

	return data


# Gets the sample step size in unix miliseconds
@app.route("/power_supply_step/<ID>")
def power_supply_step(ID):
	
	data = postgres_query(ID)

	step_size = data[0][ len(data[0]) - 1 ] - data[0][ len(data[0]) - 2] # data[0] = SMPL TIMES

	# Convert to a time in miliseconds from unix epoch
	timestep = step_size.replace(tzinfo=timezone.utc).timestamp() * 1000.0

	return timestep


@app.route("/power_supply_series/<ID>")
def power_supply_series(ID):
    
	data = postgres_query(ID)

	# Convert timestamps from python datetime objects to unix time in miliseconds
	for row in data:
		row[0] = row[0].replace(tzinfo=timezone.utc).timestamp() * 1000.0

	return jsonify(Data=data)


