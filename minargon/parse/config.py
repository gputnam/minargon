from collections import OrderedDict

from timeseries import *

class DataConfig(object):
    def __init__(self):
        self.instances = {}

    def add_instance(self, instance):
        self.instances[instance.name] = instance

    def data_instance_timeseries(self, instance_name):
        instance = self.instances[instance_name]
        (steps, server_delay) = resolve_timeseries(instance.timeseries)
        return TimeSeries(instance.name, instance.timeseries, steps, server_delay, instance.metrics) 

    def data_field_timeseries(self, instance_name, field_name):
        instance = self.instance[instance_name]
        field = self.instance[instance_name].fields[field_name]
        timeseries = self.timeseries[instance.fields.keys().index(field_name)] 
        return TimeSeries(field.name, [timeseries], timeseries.steps, timeseries.server_delay, instance.metrics)

class DataInstance(object):
    def __init__(self, name, metrics):
        self.fields = OrderedDict()
        self.timeseries = []
        self.name = name
        self.metrics = metrics

    def add_pair(self, field, timeseries):
        self.fields[field.name] = field
        self.timeseries.append(timeseries)

class DataField(object):
    def __init__(self, name):
        self.name = name

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
    


