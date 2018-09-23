import json

class TimeSeries(object):
    def __init__(self, name, datums, steps, server_delay, metrics):
        self.name = name
        self.datums = datums
        self.steps = steps
        self.server_delay = server_delay
        self.metrics = metrics

    def select_datums(self, every=1, hi=-1, maxn=-1):
        if hi < 0:
            hi = len(self.datums)
        if maxn > 0:
            every = hi / maxn
        ret = []
        for i in range(0,hi,every):
            ret.append(self.datums[i].to_dict())
        return ret
        
    def to_dict(self, **kwargs):
        return {
            "name": self.name,
            "datums": self.select_datums(**kwargs),
            "steps": self.steps,
            "server_delay": self.server_delay,
            "metrics": self.metrics
         }
    def to_json(self, **kwargs):
        return json.dumps(self.to_dict(**kwargs))
    def __str__(self):
        return self.to_json()
    def __repr__(self):
        return self.__str__()

# class corresponding to one individual time series
class TimeSeriesDatum(object):
    def __init__(self, name, data_link, constructor, steps, server_delay):
        self.name = name
        self.data_link = data_link
        self.constructor = constructor
        self.steps = steps
        self.server_delay = server_delay

    def to_dict(self):
        return {
            "name": self.name,
            "data_link": self.data_link,
            "constructor": self.constructor,
        }

    def to_json(self):
        return json.dumps(self.to_dict())

    def __str__(self):
        return self.to_json()
    def __repr__(self):
        return self.__str__()

