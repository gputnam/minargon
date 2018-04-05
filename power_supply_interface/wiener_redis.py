import struct
from pysnmp.hlapi import *

import redis
import datetime
import time

"""
    Script connecting the wiener power supply to redis
"""

# Constnats
WIENER_IP = "192.168.230.80"
WIENER_SNMP_PORT = 161
COMMUNITY_DATA = 'public'

# list of command names to send (as OID's) with their true name and the Redis name
OIDs = [
        ('.1.3.6.1.4.1.19947.1.3.2.1.10.1', 'outputVoltage.u0', 'output_voltage'),
        ('.1.3.6.1.4.1.19947.1.3.2.1.12.1', 'outputCurrent.u0', 'output_current'),
        ('.1.3.6.1.4.1.19947.1.3.2.1.5.1', 'outputMeasurementSenseVoltage.u0', 'measured_output_voltage'),
        ('.1.3.6.1.4.1.19947.1.3.2.1.23.1', 'outputConfigMaxCurrent.u0', 'max_output_current'),
        ('.1.3.6.1.4.1.19947.1.3.2.1.7.1', 'outputMeasurementCurrent.u0', 'measured_output_current'),
]

# name of power supply (for redis)
POWER_SUPPLY_NAME = "PL506"


# redis streams
# (time between storage, time until expire)
STREAM = (5, 600)

# setup snmp
engine = SnmpEngine()
community = CommunityData(COMMUNITY_DATA)
transport = UdpTransportTarget((WIENER_IP, WIENER_SNMP_PORT))
context = ContextData()

# setup redis
r = redis.Redis()

def time_now():
    return time.time()

# get initial time
t = int(time_now())

while True:
    generator = getCmd(engine, community, transport, context,
	*[ObjectType(ObjectIdentity(oid)) for oid, _, _ in OIDs],
	lookupMIB=False
    )

    # redis pipeline
    pipe = r.pipeline()
    for errorIndication, errorStatus, errorIndex, varBinds in generator:
        for i,(name, value) in enumerate(varBinds):
            opaque_ret = value.prettyPrint()[-8:]
            ret = struct.unpack('!f', opaque_ret.decode('hex'))

            print "%s: %f" % (OIDs[i][2], ret[0])
            print "REDIS TIME: %i. REAL TIME: %f" % (t, time.time())

            redis_key = "stream/%i:%i:%s:%s" % (1, t // STREAM[0], OIDs[i][2], POWER_SUPPLY_NAME)
            redis_val = str(ret[0]) 
            redis_expire = str(STREAM[1])

            # queue commands
            pipe.set(redis_key, redis_val) 
            pipe.expire(redis_key, redis_expire)

    # and execute
    pipe.execute()

    # sleep until the next time
    t += STREAM[0]
    time.sleep(t - time_now())




