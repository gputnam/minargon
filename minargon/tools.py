from __future__ import print_function
from datetime import datetime
import calendar

def total_seconds(td):
    """Returns the total number of seconds contained in the duration."""
    return (td.microseconds + (td.seconds + td.days * 24 * 3600) * 10**6) / 10**6

def parseiso(timestr):
    """Convert an iso time string -> unix timestamp."""
    dt = datetime.strptime(timestr,'%Y-%m-%dT%H:%M:%S.%fZ')
    return calendar.timegm(dt.timetuple()) + dt.microsecond/1e6

# try parsing as int, falling back to parseiso
def parseiso_or_int(inp_str):
    try:
        return int(inp_str)
    except ValueError:
        return parseiso(inp_str)

# parse input file for channel to wire mapping
def parse_channel_map_file(fname, n_channels):
    channel_to_wire = [0 for i in range(n_channels)]
    wire_to_channel = [0 for i in range(n_channels)]
    with open(fname) as f:
        for i,line in enumerate(f):
            dat = line.split(" ")
            channel = int(dat[0])
            wire = int(dat[1])
            channel_to_wire[channel] = wire
            wire_to_channel[wire] = channel
    return (channel_to_wire, wire_to_channel)

# 1-1 mapping for debugging purposes
def default_channel_map(n_channels):
    channel_to_wire = [i for i in range(n_channels)]
    wire_to_channel = [i for i in range(n_channels)]
    return (channel_to_wire, wire_to_channel)
    


