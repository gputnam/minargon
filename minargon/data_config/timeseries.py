import json

class TimeSeries(object):
    def __init__(self, instance, **kwargs):
        self.name = instance.name
        self.data_link = instance.timeseries
        self.steps = instance.steps
        self.server_delay = instance.server_delay
        self.metrics = instance.metrics
        self.instance = instance
        self.select_fields(**kwargs)

    def select_fields(self, every=1, hi=-1, maxn=-1, fields=None):
        self.fields = []
        if fields is None:
            if hi < 0:
                hi = len(self.instance.fields)
            if maxn > 0:
                every = hi / maxn + (hi % maxn != 0)
            field_list = self.instance.fields.values()
            for i in range(0,hi,every):
                self.fields.append(field_list[i])
        else:
            for field in fields:
                self.fields.append(self.instance.fields[field])
        
    def to_dict(self):
        return {
            "name": self.name,
            "data_link": self.data_link,
            "steps": self.steps,
            "server_delay": self.server_delay,
            "metrics": self.metrics,
            "metric_list": [metric for metric,_ in self.metrics.items()],
            "instance": self.instance.to_dict(),
            "fields": [f.to_dict() for f in self.fields],
         }

    def to_json(self, **kwargs):
        return json.dumps(self.to_dict(**kwargs))
    def __str__(self):
        return self.to_json()
    def __repr__(self):
        return self.__str__()

# class corresponding to one individual time series
# UNUSED
class TimeSeriesDatum(object):
    def __init__(self, field, instance, data_link, steps, server_delay):
        self.field = field
        self.data_link = data_link
        self.steps = steps
        self.server_delay = server_delay
        self.instance = instance

    def to_dict(self):
        return {
            "field": self.field.to_dict(),
            "instance": self.instance.to_dict(),
            "data_link": self.data_link,
        }

    def to_json(self):
        return json.dumps(self.to_dict())

    def __str__(self):
        return self.to_json()
    def __repr__(self):
        return self.__str__()

