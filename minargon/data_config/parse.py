import json
import collections
from collections import OrderedDict

from functions import ParserFunctions
from timeseries import TimeSeries, TimeSeriesDatum
from field_data import *
from config import *

RESERVED_FIELD_KEYS = ["name"]
RESERVED_INSTANCE_KEYS = ["types", "name", "steps", "server_delay", "metrics", "fields", "timeseries_link", "field_data_link"]
FIELD_KEY_IDENT = "field."

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
            types = self.get_instance_param("types", instance, "", config, {}, required=False)
            if types is None:
                types = {"": {}}
            else:
                types = self.build_types(types)

            for typ, typ_config in types.items():
                name = self.get_instance_param("name", instance, typ, config, typ_config)
                steps = self.get_instance_param("steps", instance, typ, config, typ_config)
                server_delay = self.get_instance_param("server_delay", instance, typ, config, typ_config)
                metrics = self.build_metrics(self.get_instance_param("metrics", instance, typ, config, typ_config), metrics_config)

                userdata = self.get_instance_userdata(instance, typ, config, typ_config)

                data_instance = DataInstance(name, metrics, steps, server_delay, userdata)

                # get the fields for this type
                fields = self.build_fields(self.get_instance_param("fields", instance, typ, config, typ_config))
                for field, field_config in fields.items():
                    # now build the timeseries objects
                    name = self.get_field_param("name", instance, typ, field, config, typ_config, field_config)
                    userdata = self.get_field_userdata(instance, typ, field, config, typ_config, field_config)

                    data_field = DataField(name, userdata)
                    data_instance.add_field(data_field)

                # maybe get timeseries
                timeseries = self.get_instance_param("timeseries_link", instance, typ, config, typ_config, required=False)
                if timeseries is not None:
                    data_instance.add_timeseries(timeseries)
                # maybe get field data
                field_data = self.get_instance_param("field_data_link", instance, typ, config, typ_config, required=False)
                if field_data is not None:
                    data_instance.add_field_data(field_data)

                self.config.add_instance(data_instance)

    def get_field_userdata(self, instance_name, type_name, field_name, instance_config, type_config, field_config):
        ret = {}
        for key,val in field_config.items():
            if key not in RESRVED_FIELD_KEYS: 
                ret[key] = self.field_format(val, instance_name, type_name, field_name)
        for key,val in type_config.items():
            if key.startswith(FIELD_KEY_IDENT):
                key = key.split(FIELD_KEY_IDENT)[1]
                if key not in RESERVED_FIELD_KEYS and key not in ret:
                    ret[key] = self.field_format(val, instance_name, type_name, field_name)
        for key,val in instance_config.items():
            if key.startswith(FIELD_KEY_IDENT):
                key = key.split(FIELD_KEY_IDENT)[1]
                if key not in RESERVED_FIELD_KEYS and key not in ret:
                    ret[key] = self.field_format(val, instance_name, type_name, field_name)
        return ret

    def get_instance_userdata(self, instance_name, type_name, instance_config, type_config):
        ret = {}
        for key, val in type_config.items():
            if not key.startswith(FIELD_KEY_IDENT) and key not in RESERVED_INSTANCE_KEYS and key not in ret:
                ret[key] = self.instance_format(val, instance_name, type_name)
        for key, val in instance_config.items():
            if not key.startswith(FIELD_KEY_IDENT) and key not in RESERVED_INSTANCE_KEYS and key not in ret:
                ret[key] = self.instance_format(val, instance_name, type_name)
        return ret

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

        parent_param = FIELD_KEY_IDENT + param 
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

    def get_instance_param(self, param, instance_name, type_name, parent_config, type_config, required=True):
        if param in type_config:
            return self.instance_format(type_config[param], instance_name, type_name)

        parent_param = param 
        if parent_param in parent_config:
            return self.instance_format(parent_config[parent_param], instance_name, type_name) 

        if required:
            raise ValueError("Required TYPE parameter '%s' not provided in type '%s' instance '%s'" % (param, type_name, instance_name))

        return None

    def instance_format(self, val, instance_name, type_name):
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
            if not hasattr(self.functions, fname):
                raise ValueError("Function '%s' does not exist" % fname)
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
    

