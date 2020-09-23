from __future__ import print_function
from datetime import datetime
import calendar

from werkzeug.routing import BaseConverter


class ListConverter(BaseConverter):
    def to_python(self, value):
        return [x for x in value.split(',') if len(x) > 0]
    def to_url(self, values):
        return ','.join(super(ListConverter, self).to_url(value)
                        for value in values)

class DataStream(object):
    def __init__(self, name):
        self.name = name

class RedisDataStream(DataStream):
    def __init__(self, name, key):
        super(RedisDataStream, self).__init__(name)
        self.key = key

    def to_config(self):
        dtype = "redis"
        database = self.name
        
        try:
            metric_name = self.key.split(":")[-2]
        except:
            metric_name = self.key
        config = {
          "title": self.key,
          "yTitle": metric_name
        }
        return (dtype, self.key, database, config)

class PostgresDataStream(DataStream):
    def __init__(self, name, ID):
        super(PostgresDataStream, self).__init__(name)
        self.ID = ID

    def to_config(self):
        from metrics.postgres_api import pv_meta_internal
        dtype = "postgres"
        database = self.name
        config = pv_meta_internal(database, self.ID, front_end_abort=True)
        return (dtype, self.ID, database, config)  

class StreamConverter(BaseConverter):
    def to_python(self, value):
        database = value.split(",")[0]
        ID = value.split(",")[1]
        if database.startswith("postgres_"):
            database_name = database[9:]
            return PostgresDataStream(database_name, ID)
        elif database.startswith("redis_"):
            database_name = database[6:]
            return RedisDataStream(database_name, ID)
        else:
            raise ValueError

    def to_url(self, stream):
        if isinstance(stream, PostgresDataStream):
            return ",".join(["postgres_" + stream.name] + [str(stream.ID)])
        elif isinstance(stream, RedisDataStream):
            return ",".join(["redis_" + stream.name] + [stream.key])

def total_seconds(td):
    """Returns the total number of seconds contained in the duration."""
    return (td.microseconds + (td.seconds + td.days * 24 * 3600) * 10**6) / 10**6

def parseiso(timestr):
    """Convert an iso time string -> [ms] unix timestamp."""
    try: 
    	dt = datetime.strptime(timestr,'%Y-%m-%dT%H:%M:%S.%fZ')
    except:
	dt = datetime.strptime(timestr, '%m/%d/%Y %H:%M')
    return int(calendar.timegm(dt.timetuple())*1e3 + dt.microsecond/1e3)

# try parsing as int, falling back to parseiso
def parseiso_or_int(inp_str):
    try:
        return int(inp_str)
    except ValueError:
        try:
            return parseiso(str(inp_str))
        except:
            return None
    

def stream_args(args):
    ret = {}
    ret["start"] = args.get('start',None,type=parseiso_or_int)
    ret["stop"] = args.get('stop', None,type=parseiso_or_int)
    ret["n_data"] = args.get('n_data', 1000, type=int)

    return ret
    


