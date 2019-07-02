#!/usr/bin/env python

import os
import subprocess 
import psycopg2

print "Content-Type: text/html\n\n"
print """
<!DOCTYPE html>
<html>
  <head>
    <title>Icarus GPS Attributes</title>
    <link href="/css/bootstrap.css" rel="stylesheet">
  </head>
    <script src="/js/jquery.js"></script>
    <script src="/js/bootstrap-treeview.js"></script>
    <style>
      table
      {
        border:1px solid black;padding:5px;font-size: 140%
      }
      td
      {
        text-align:right;
        border:1px solid grey;padding:5px;
      }
      th
      {
        text-align:center;
        border:1px solid grey;padding:5px;
      }
      body
      {
        margin: 28px;
      }
  </style>
  </head>
  <body>
  <body>
    <h1>Icarus GPS Attributes</h1>
"""

file = open("/web/sites/s/sbn-online.fnal.gov/data/.epics/epics_icarus.dat","r");
u = (file.readline()).strip();
p = (file.readline()).strip();

file.close();
print ":)\n"
try:
  connection = psycopg2.connect(database="icarus_online_prd", user=u,
    password=p,host="icarus-db.fnal.gov", port="5434");
except psycopg2.DatabaseError as error:
  print "<PRE>\n"
  print(error)
  print "</PRE>\n"

cursor = connection.cursor();
#query="""SELECT CHANNEL_ID, NAME FROM DCS_PRD.CHANNEL WHERE NAME LIKE '%GPS%' ORDER BY CHANNEL_ID;"""
#query="""select c1.channel_id, c1.name, s1.smpl_time, s1.float_val from dcs_prd.channel c1 left join dcs_prd.sample s1 on c1.channel_id = s1.channel_id where s1.smpl_time = (select max(smpl_time) from dcs_prd.sample s2 where s1.channel_id = s2.channel_id and s1.channel_id>0 and s1.channel_id<24) order by c1.channel_id;"""
query = """SELECT SMPL_TIME,FLOAT_VAL FROM DCS_PRD.SAMPLE S1 WHERE CHANNEL_ID>0 AND CHANNEL_ID<24 
  AND SMPL_TIME=(SELECT MAX(SMPL_TIME) FROM DCS_PRD.SAMPLE S2 WHERE S2.CHANNEL_ID=S1.CHANNEL_ID) 
  ORDER BY S1.CHANNEL_ID;"""
cursor.execute(query)#"""SELECT CHANNEL_ID FROM DCS_PRD.SAMPLE WHERE CHANNEL_ID IN (1,2,3,6,7,10,11,12,13,14,15,16,17,18,19,20,21,22,23)""")
rows = cursor.fetchall();
cursor.close();

# measurements
names = ["ICARUS_GPS_GPS_0/latitude","ICARUS_GPS_GPS_0/longitude","ICARUS_GPS_GPS_0/sigmaPPS","ICARUS_GPS_GPS_0/systemDifference","ICARUS_GPS_GPS_0/timeStamp","ICARUS_GPS_GPS_0/status","ICARUS_GPS_GPS_0/oscillatorQuality","ICARUS_GPS_GPS_0/ppsDifference","ICARUS_GPS_GPS_0/finePhaseComparator","ICARUS_GPS_GPS_0/message","ICARUS_GPS_GPS_0/transferQuality","ICARUS_GPS_GPS_0/actualFrequency","ICARUS_GPS_GPS_0/holdoverFrequency","ICARUS_GPS_GPS_0/eepromFrequency","ICARUS_GPS_GPS_0/loopTimeConstantMode","ICARUS_GPS_GPS_0/loopTimeConstantInUse","ICARUS_GPS_GPS_0/messageStatus","ICARUS_GPS_GPS_0/hemisphereNS","ICARUS_GPS_GPS_0/hemisphereEW","ICARUS_GPS_GPS_0/TimeStampString","ICARUS_GPS_GPS_0/location","ICARUS_GPS_GPS_0/systemTimeNSec","ICARUS_GPS_GPS_0/systemTimeSec"]

#  
i = 0
j = 0
#for row in rows:
 # print rows[i]
 # print "\n"   

print "<TABLE>\n"
print "<TR><TH>Measurement </TH><TH> Time </TH><TH> Value </TH></TR>\n"
i = 0
for row in rows:
  tag1 = ""
  tag2 = "" 
  # print i
  print "<TR><TD STYLE =\"text-align:left\">" +names[i]+"</TD><TD>" + str(row[0]) +"</TD><TD>" + str(row[1]) + "</TD></TR>" #<TD>"+tag1+str(round(row[1],2))+tag2+"</TD><TD>"+str(row[0])+"</TD></TR>\n"
  i = i + 1
print "</TABLE>\n"
print "</body>\n"
print "</html>\n"

connection.close()
