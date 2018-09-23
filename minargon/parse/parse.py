import json
import collections
from collections import OrderedDict

from functions import ParserFunctions
from timeseries import TimeSeries, TimeSeriesDatum
from config import *

class DataParser(object):
    def __init__(self, redis_config):
        # Setup parser functions
        self.functions = ParserFunctions(redis_config) 

        # get the DataConfig file
        with open(redis_config["DATA_CONFIG"]) as f:
            data_config_json = json.load(f, object_pairs_hook=OrderedDict)

        self.config = DataConfig()

        instances_config = data_config_json["instances"]
        metrics_config = data_config_json["metrics"]

        # buld the timeseries objects
        for instance, config in instances_config.items():
            types = self.build_types(self.get_instance_param("types", instance, config))
            for typ, typ_config in types.items():
                name = self.get_type_param("name", instance, typ, config, typ_config)
                metrics = self.build_metrics(self.get_instance_param("metrics", instance, config), metrics_config)
                data_instance = DataInstance(name, metrics)

                # get the fields for this type
                fields = self.build_fields(self.get_type_param("fields", instance, typ, config, typ_config))
                for field, field_config in fields.items():
                    # now build the timeseries objects
                    name = self.get_field_param("name", instance, typ, field, config, typ_config, field_config)
                    timeseries = self.get_field_param("timeseries", instance, typ, field, config, typ_config, field_config)

                    data_timeseries = self.build_timeseries(name, timeseries, instance, typ, field)
                    data_field = DataField(name)
              
                    data_instance.add_pair(data_field, data_timeseries)

                self.config.add_instance(data_instance)

    def build_timeseries(self, name, config, instance, typ, field):
        required_items = ["data_link", "constructor", "steps", "server_delay"]
        for item in required_items:
            if item not in config:
                raise ValueError("Timeseries config missing parameter %s" % item)
        if not isinstance(config["constructor"], OrderedDict):
            raise ValueError("Bad timeseries constructor")
        constructor = {}
        for key, val in config["constructor"].items():
            constructor[key] = self.field_format(val, instance, typ, field)
        return TimeSeriesDatum(name, config["data_link"], constructor, config["steps"], config["server_delay"])

    def build_metrics(self, metrics, metric_config):
        metrics_out = self.build_types(metrics)
        for metric, conf in metrics_out.items():
            if metric in metric_config:
                for item, default in metric_config[metric].items():
                    if item not in conf:
                        conf[item] = default
        return metrics_out
            
    def get_field_param(self, param, instance_name, type_name, field_name, instance_config, type_config, field_config, required=True):
        if param in field_config:
            return self.field_format(field_config[param], instance_name, type_name, field_name)

        parent_param = "field." + param 
        if parent_param in type_config:
            return self.field_format(type_config[parent_param], instance_name, type_name, field_name)
        if parent_param in instance_config:
            return self.field_format(instance_config[parent_param], instance_name, type_name, field_name)

        if required:
            raise ValueError("Required FIELD parameter '%s' not provided in field '%s' type '%s' instance '%s'" % (param, field_name, type_name, instance_name))

        return None

    def field_format(self, val, instance_name, type_name, field_name):
        # reformat if string
        if isinstance(val, unicode):
            return val % {"instance": instance_name, "type": type_name, "field": field_name} 
        # otherwise do nothing
        return val

    def get_instance_param(self, param, name, config, required=True):
        if param in config:
            return self.instance_format(config[param], name)
        if required:
            raise ValueError("Required INSTANCE parameter '%s' not provided in instance '%s'" % (param, name))
        return None

    def instance_format(self, val, name):
        # reformat if string
        if isinstance(val, unicode):
            return val % {"instance": name} 
        # otherwise do nothing
        return val
                
    def get_type_param(self, param, instance_name, type_name, parent_config, type_config, required=True):
        if param in type_config:
            return self.type_format(type_config[param], instance_name, type_name)

        parent_param = "type." + param 
        if parent_param in parent_config:
            return self.type_format(parent_config[parent_param], instance_name, type_name) 

        if required:
            raise ValueError("Required TYPE parameter '%s' not provided in type '%s' instance '%s'" % (param, type_name, instance_name))

        return None

    def type_format(self, val, instance_name, type_name):
        # reformat if string
        if isinstance(val, unicode):
            return val % {"type": type_name, "instance": instance_name} 
        # otherwise do nothing
        return val


    def build_types(self, typeset):
        # if string, call appropriate function
        if isinstance(typeset, unicode):
            function_str = typeset.split(" ")
            fname = function_str[0]
            assert(hasattr(self.functions, fname))
            func = getattr(self.functions, fname)
            if len(function_str) == 1:
                typeset = func()
            else:
                typeset = func(*function_str[1:])

        # if already dictionary, no need
        if isinstance(typeset, OrderedDict):
            return typeset
        # if list, map to default dictionary
        if isinstance(typeset, list):
            ret = OrderedDict()
            for t in typeset:
                if isinstance(t, OrderedDict): 
                    name = t["name"] 
                    ret[name] = t
                else:
                    ret[str(t)] = {}
            return ret 

        # if here, something went wrong
        raise ValueError("Bad specifier for type")
    
    # does the same thing as building types
    def build_fields(self, fieldset):
        return self.build_types(fieldset)
    

