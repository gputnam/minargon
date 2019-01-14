from collections import OrderedDict
import json

from timeseries import *
from field_data import *

class DataConfig(object):
    def __init__(self):
        self.instances = {}

    def set_metrics(self, metric_config):
        self.metrics = metric_config

    def get_metrics(self):
        return self.metrics

    def add_instance(self, instance):
        self.instances[instance.name] = instance

    def get_instance(self, instance_name):
        return self.instances[instance_name]

    def data_instance_timeseries(self, instance, metrics, **kwargs):
        return TimeSeries(instance, metrics, **kwargs)

    def data_field_timeseries(self, instance, field_name):
        return TimeSeries(instance, self.metrics, fields=[field_name])

    def data_instance_field_data(self, instance, metrics):
        return FieldData(instance, metrics)

class DataInstance(object):
    def __init__(self, name, link, userdata):
        self.fields = OrderedDict()
        self.name = name
        self.link = link
        self._userdata = userdata
        for key, val in userdata.items():
            setattr(self, key, val)

    def add_field(self, field):
        self.fields[field.name] = field

    def to_dict(self):
        return dict(name=self.name, link=self.link, **self._userdata)

    def to_json(self):
        return json.dumps(self.to_dict())
   

class DataField(object):
    def __init__(self, name, link, userdata):
        self.name = name
        self.link = link
        self._userdata = userdata
        for key, val in userdata.items():
            setattr(self, key, val)

    def to_dict(self):
        return dict(link=self.link, name=self.name, **self._userdata)

    def to_json(self):
        return json.dumps(self.to_dict())
        

def resolve_timeseries(timeseries):
    server_delay = None
    steps = None
    for t in timeseries:
        if server_delay is None or t.server_delay > server_delay:
            server_delay = t.server_delay
        if steps is None:
            steps = t.steps
        else:
            for s in steps:
                if s not in t.steps:
                    steps.remove(s)
    return (steps, server_delay)
    


