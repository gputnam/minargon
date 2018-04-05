import struct
from pysnmp.hlapi import *

"""
    Example script which just prints out some information about a wiener power supply on the network
"""

# Constnats
WIENER_IP = "192.168.230.80"
WIENER_SNMP_PORT = 161
COMMUNITY_DATA = 'public'

# list of command names to send (as OID's) with their true name
OIDs = [
        ('.1.3.6.1.4.1.19947.1.3.2.1.10.1', 'outputVoltage.u0'),
        ('.1.3.6.1.4.1.19947.1.3.2.1.12.1', 'outputCurrent.u0'),
        ('.1.3.6.1.4.1.19947.1.3.2.1.5.1', 'outputMeasurementSenseVoltage.u0'),
        ('.1.3.6.1.4.1.19947.1.3.2.1.23.1', 'outputConfigMaxCurrent.u0'),
        ('.1.3.6.1.4.1.19947.1.3.2.1.7.1', 'outputMeasurementCurrent.u0'),
]


generator = getCmd(SnmpEngine(),
        CommunityData(COMMUNITY_DATA),
        UdpTransportTarget((WIENER_IP, WIENER_SNMP_PORT)),
        ContextData(),
        *[ObjectType(ObjectIdentity(oid)) for oid, _ in OIDs],
        lookupMIB=False
)

for errorIndication, errorStatus, errorIndex, varBinds in generator:
    for i,(name, value) in enumerate(varBinds):
        opaque_ret = value.prettyPrint()[-8:]
        ret = struct.unpack('!f', opaque_ret.decode('hex'))
        print "%s: %f" % (OIDs[i][1], ret[0])
