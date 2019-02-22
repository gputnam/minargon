from __future__ import print_function
from datetime import datetime
import calendar

from werkzeug.routing import BaseConverter

class ListConverter(BaseConverter):
    def to_python(self, value):
        return [x for x in value.split(',') if len(x) > 0]
    def to_url(self, values):
        return ','.join(BaseConverter.to_url(value)
                        for value in values)
def total_seconds(td):
    """Returns the total number of seconds contained in the duration."""
    return (td.microseconds + (td.seconds + td.days * 24 * 3600) * 10**6) / 10**6

def parseiso(timestr):
    """Convert an iso time string -> [ms] unix timestamp."""
    dt = datetime.strptime(timestr,'%Y-%m-%dT%H:%M:%S.%fZ')
    return calendar.timegm(dt.timetuple())*1e3 + dt.microsecond/1e3

# try parsing as int, falling back to parseiso
def parseiso_or_int(inp_str):
    try:
        return int(inp_str)
    except ValueError:
        return parseiso(inp_str)

def stream_args(args):
    ret = {}
    ret["start"] = args.get('start',None,type=parseiso_or_int)
    ret["stop"] = args.get('stop', None,type=parseiso_or_int)
    ret["n_data"] = args.get('n_data', None, type=int)

    return ret
    


