from redis import Redis
from flask import jsonify

# import gevent

# get a single redis key value
def get_key(rdb, key):
    # key may be individual value or list
    key_type = rdb.type(key)
    if key_type == "list":
        redis_data = list(rdb.lrange(key, 0, -1))
    elif key_type == "string":
        redis_data = rdb.get(key)
    else:
        redis_data = 0 
    return redis_data

# get most recent data point from a set of streams
def get_last_streams(rdb, stream_list,count=1):
    ret = {}
    pipeline = rdb.pipeline()
    for stream in stream_list:
        pipeline.xrevrange(stream, count=count)
    for stream, data in zip(stream_list, pipeline.execute()):
        ret[stream] = []
        for datapoint in data:
            time = datapoint[0].split("-")[0]
            if "dat" not in datapoint[1]:
                continue
            val = datapoint[1]["dat"]
            ret[stream].append((time, val))
    return ret

# get number of data points from list of streams
def get_streams(rdb, stream_list, n_data=None, start=None, stop=None):
    if start is None:
        start = u'-'
    else:
        start += 1
    if stop is None:
        stop = u'+'
    ret = {}
    pipeline = rdb.pipeline()
    for stream in stream_list:
        pipeline.xrange(stream, min=start, max=stop, count=n_data)
    for stream, data in zip(stream_list, pipeline.execute()):
        ret[stream] = []
        for d in data:
            time =  d[0].split("-")[0]
            if "dat" not in d[1]:
                 continue
            val = d[1]["dat"]
            ret[stream].append( (time, val) )
    return ret

def block_streams(rdb, streams):
    while True:
        ret = {}
        n_received = 0
        #while n_received < len(streams):
        while n_received < 1:
            data = rdb.xread(streams, block=0)
            for stream_data in data:
                stream = stream_data[0]
                ret[stream] = []
                for d in stream_data[1]:
                    n_received += 1
                    time = d[0].split("-")[0]
                    val = d[1]["dat"]
                    ret[stream].append( (time, val) )
                streams[stream] = ret[stream][-1][0]
        yield ret

def subscribe_streams(rdb, stream_list, n_data=None, start=None, stop=None):
    data = get_streams(rdb, stream_list, n_data, start, stop)
    streams = {}
    for s in stream_list:
        if len(data[s]) > 0:
            streams[s] = data[s][-1][0] # set "last seen" to most recent time value
        else:
            streams[s] = 0
    
    yield data

    for item in block_streams(rdb, streams):
        yield item

def clean_float(x):
    ret = float(x)
    if math.isnan(ret):
        ret = "NaN"
    return ret

