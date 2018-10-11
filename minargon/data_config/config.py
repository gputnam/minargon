from collections import OrderedDict
import json

from timeseries import *
from field_data import *

class DataConfig(object):
    def __init__(self):
        self.instances = {}

    def add_instance(self, instance):
        self.instances[instance.name] = instance

    def data_instance_timeseries(self, instance_name, **kwargs):
        instance = self.instances[instance_name]
        if instance.timeseries is None:
            raise ValueError("Instance %s does not have timeseries" % instance_name)
        return TimeSeries(instance, **kwargs)

    def data_field_timeseries(self, instance_name, field_name):
        instance = self.instances[instance_name]
        if instance.timeseries is None:
            raise ValueError("Instance %s does not have timeseries" % instance_name)
        return TimeSeries(instance, fields=[field_name])

    def data_instance_field_data(self, instance_name):
        instance = self.instances[instance_name]
        if instance.field_data is None:
            raise ValueError("Instance %s does not have field data" % instance_name)
        return FieldData(instance)

class DataInstance(object):
    def __init__(self, name, metrics, steps, server_delay, userdata):
        self.fields = OrderedDict()
        self.name = name
        self.steps = steps
        self.server_delay = server_delay
        self.metrics = metrics
        self._userdata = userdata
        for key, val in userdata.items():
            setattr(self, key, val)

        self.field_data = None
        self.timeseries = None

    def add_field(self, field):
        self.fields[field.name] = field

    def add_timeseries(self, timeseries_link):
        self.timeseries = timeseries_link

    def add_field_data(self, field_data_link):
        self.field_data = field_data_link

    def to_dict(self):
        return dict(name=self.name, **self._userdata)

    def to_json(self):
        return json.dumps(self.to_dict())
   

class DataField(object):
    def __init__(self, name, userdata):
        self.name = name
        self._userdata = userdata
        for key, val in userdata.items():
            setattr(self, key, val)

    def to_dict(self):
        return dict(name=self.name, **self._userdata)

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
    


