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

from . import app
from flask import jsonify

# Read in file with user(u) and password(p)
file = open(app.config["EPICS_SECRET_KEY"],"r") 
u = (file.readline()).strip(); # strip: removes leading and trailing chars
p = (file.readline()).strip()
file.close()

# Connect to the database
connection = psycopg2.connect(database=app.config["POSTGRES_DB"], user=u, 
  password=p,host=app.config["POSTGRES_HOST"], port=app.config["POSTGRES_PORT"])

app.config["POSTGRES_HOST"]

 # Cursor allows python to execute a postgres command in the database session. 
cursor = connection.cursor(cursor_factory=RealDictCursor) # Fancy way of using cursor

@app.route("/power_supply_series/<ID>")
def power_supply_series(ID):

    # convert python date time object to postgres

    # stream args to get start and stop from the user in tools.py 
   
    # Database query to execute
    query="""SELECT SMPL_TIME AS SAMPLE_TIME,FLOAT_VAL AS VALUE
    FROM SAMPLE WHERE CHANNEL_ID=%s AND (NOW()-SMPL_TIME)<(INTERVAL '1 day') ORDER BY SMPL_TIME;""" % ID

    cursor.execute(query)

    data = cursor.fetchall()

    # cursor.connection.close() # for now don't close the connection with the database, may cause problems down the line

    return jsonify(Data=data)







