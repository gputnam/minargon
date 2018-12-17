import json

class FieldData(object):
    def __init__(self, instance, metric_config):
        self.name = instance.name
        self.instance_link = instance.link
        self.fields = instance.fields
        self.metric_config = metric_config
        self.instance = instance

    def to_dict(self):
        return {
            "name": self.name,
            "instance_link": self.instance_link,
            "fields": [f.to_dict() for _,f in self.fields.items()],
            "metric_config": self.metric_config,
            "metric_list": [k for k,_ in self.metric_config.items()],
            "instance": self.instance.to_dict(),
        }

    def to_json(self):
        return json.dumps(self.to_dict())
    def __str__(self):
        return self.to_json()
    def __repr__(self):
        return self.__str__()
