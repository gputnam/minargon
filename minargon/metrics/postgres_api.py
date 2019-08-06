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
from flask import jsonify, request, render_template, abort, current_app
from datetime import datetime, timedelta # needed for testing only
import time
import calendar
from pytz import timezone

# status interpreter functions
from checkStatus import statusString
from checkStatus import oscillatorString
from checkStatus import transferString
from checkStatus import messageString


# error class for connecting to postgres
class PostgresConnectionError:
    def __init__(self):
        self.err = None
        self.msg = "Unknown Error"
        self.name = "Unknown"


    def with_front_end(self, front_end_abort):
        self.front_end_abort = front_end_abort
        return self

    def register_postgres_error(self, err, name):
        self.err = err
        self.name = name
        self.msg = str(err)
        return self

    def register_fileopen_error(self, err, name):
        self.err = err
        self.name = name
        self.msg = "Error opening secret key file: %s" % err[1]
        return self

    def register_notfound_error(self, name):
        self.name = name
        self.msg = "Database (%s) not found" % name
        return self

    def message(self):
        return self.msg
    def database_name(self):
        return self.name

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
    
    try:
        with open(key) as f:
            u = (f.readline()).strip() # strip: removes leading and trailing chars
            p = (f.readline()).strip()
    except IOError as err:
        connection = PostgresConnectionError().register_fileopen_error(err, connection_name)
        success = False
        p_databases[connection_name] = (connection, config, success)
        continue
    
    config["web_name"] = connection_name
    # Connect to the database
    try:
        connection = psycopg2.connect(database=database_name, user=u, password=p, host=host, port=port)
        success = True
    except psycopg2.OperationalError as err:
        connection = PostgresConnectionError().register_postgres_error(err, connection_name)
        success = False
    
    # store it
    p_databases[connection_name] = (connection, config, success)
#________________________________________________________________________________________________
# decorator for getting the correct database from the provided link
def postgres_route(func):
    from functools import wraps
    @wraps(func)
    def wrapper(connection, *args, **kwargs):
        front_end_abort = kwargs.pop("front_end_abort", False)
        if connection in p_databases:
            connection, config, success = p_databases[connection]
            if success:
                return func((connection,config), *args, **kwargs)
            else:
                error = connection.with_front_end(front_end_abort)
                return abort(503, error)
        else:
            return abort(404, PostgresConnectionError().register_notfound_error(connection).with_front_end(front_end_abort))
        
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
    cursor = connection.cursor() 

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
            "selectable" : "false",
            "displayCheckbox": False,
            "nodes" : []
        }
    else: # ICARUS
        pydict =	{ 
            "text" : ["ICARUS Process Variables"],
            "expanded": "true",
            "color" : "#000000",
            "selectable" : "false",
            "displayCheckbox": False,
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
            pydict["nodes"].append( { "color" : "#7D3C98",
                                      "expanded": "false",
                                      "text" : str(row[0]),
                                      "href": "#parent1",
                                      "nodes" : [],
                                      "displayCheckbox": False,
                                      "tags": [""]
                                    } ) # Top Level 
            old[0] = row[0]         
            index[0] = index[0] + 1 # Increment the index
            index[1] = 0

        # Header 2
        if row[1] != old[1]: # only use chan name part 2 once in loop to avoid overcounting 
            tags[1] = 0
            pydict["nodes"][index[0] - 1 ]["nodes"].append( { "href":"#child",
                                                              "expanded": "false",
                                                              "tags":[""],
                                                              "displayCheckbox": False,
                                                              "text" : str(row[1]),
                                                              "nodes": [],
                                                              "href": app.config["WEB_ROOT"] + "/" + "pv_multiple_stream" + "/" + config["web_name"] + "/" + str(row[1])
                                                            } ) # Level 2
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
            pydict["nodes"][index[0] - 1 ]["nodes"][index[1] - 1]["nodes"].append({ 
                "text" : str(row[2]), 
                "tags" : ["ID: "+ str(row[3])],
                "tagsClass": ['badge'],
                "database": config["web_name"], 
                "database_type": "postgres",
                "ID": str(row[3]), 
                "name": str(row[2]), 
                "color" : "#229954",
                "href": app.config["WEB_ROOT"] + "/" + link_name + "/" + config["web_name"] + "/" + str(row[3])  
            }) # Level 3
        else: 
            pydict["nodes"][index[0] - 1 ]["nodes"][index[1] - 1]["nodes"].append({ 
                "text" : str(row[2]), 
                "tags" : ["ID: "+ str(row[3])],
                "tagsClass": ['badge'],
                "database": config["web_name"], 
                "database_type": "postgres",
                "color" : "#229954",
                "ID": str(row[3]), 
                "name": str(row[2])  
            }) # Level 3
        
        index[2] = index[2] + 1
        tags[1] = tags[1] + 1	
    
    # Decide what type of data to return
    if ret_id is None:
        return pydict # return the full tree
    else:
        return list_id # return the ids of a variable
#________________________________________________________________________________________________
# A function to get the process variable descriptions which are stored in a 
# PV_Description.json config file
def get_pv_description(ID):
    
    # Get the path to the config
    APP_ROOT = os.path.dirname(os.path.abspath(__file__))   # Refers to folder where postgres_api.py is located
    APP_STATIC = os.path.join(APP_ROOT, 'config')
    
    # Get the config file -- in principle we will want to have a congig file
    # for icarus and sbnd which will be located in their own folders 
    # rather than in the metrics area this current setup is for test purposes
    with open(os.path.join(APP_STATIC, 'pv_descriptions.json')) as f:
        datastore = json.load(f)

    try:
        # INDEX 0: Name of pv, INDEX 1: Description of pv
        return datastore[str(ID)][1]
    except KeyError:
        return "Description field has not been set for this variable"

#________________________________________________________________________________________________
@postgres_route
def get_gps(connection):
    cursor = connection[0].cursor();
    # since strings cannot coalesce with floating point or integer types, we must first convert those into numeric and then strings to be able to coalesce.
    # ex: (float::numeric)::text
    # get the unit from another table (num_metadata) by using a left join
    query = """select c1.name, c1.last_smpl_time, coalesce((c1.last_num_val::numeric)::text,(c1.last_float_val::numeric)::text, c1.last_str_val), m1.unit from dcs_prd.channel c1 left join dcs_prd.num_metadata m1 on c1.channel_id = m1.channel_id where c1.channel_id in (3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,20,21,42,43) order by c1.channel_id;"""
   # where name like '%GPS%' order by c1.channel_id;"""

    #
    cursor.execute(query);
    dbrows = cursor.fetchall();
    cursor.close();
    
    # converting to a list does not work : yields another tuple and thus immutable
    # why do we need to change an element? Because 4 components need to go through an interpreter
    # to interpret the status ( the integer has a corresponding message/code/string )
    # solution: create new list, copy elements into list, getting the new strings from checkStatus.py
    # note: elements in formatted are still immutable. Most likely due to row[0] being a tuple
    formatted = []
    i = 0
    for row in dbrows:
        time = row[1].strftime("%Y-%m-%d %H:%M")
        if row[0].endswith("/message"):
            formatted.append((row[0], time, messageString(row[2]), row[3]))
        elif row[0].endswith("/transferQuality"):
            formatted.append((row[0], time, transferString(row[2]), row[3]))
        elif row[0].endswith("/oscillatorQuality"):
            formatted.append((row[0], time, oscillatorString(row[2]), row[3]))
        elif row[0].endswith("/status"):
            formatted.append((row[0], time, statusString(row[2]), row[3]))
        elif row[0].endswith("/TimeStampString"):
            formatted.insert(0, (row[0], time, row[2], row[3]))
        elif row[0].endswith("/location"):
            formatted.insert(0, (row[0], time, row[2], row[3]))
        elif row[0].endswith("/sigmaPPS") or row[0].endswith("/systemDifference"):
            flt_val = float(row[2]) #"{:.4f}".format(row[2])
            flt_str = "{:.4f}".format(flt_val)
            formatted.append((row[0], time, flt_str, row[3]))
        else:
            formatted.append((row[0], time, unicode(row[2], "utf-8"), row[3]))
        i = i + 1
        #dbrows
    
    return formatted
    
