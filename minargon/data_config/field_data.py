import json

class FieldData(object):
    def __init__(self, instance):
        self.name = instance.name
        self.data_link = instance.field_data
        self.fields = instance.fields
        self.metrics = instance.metrics
        self.steps = instance.steps
        self.server_delay = instance.server_delay
        self.instance = instance

    def to_dict(self):
        return {
            "name": self.name,
            "data_link": self.data_link,
            "fields": [f.to_dict() for _,f in self.fields.items()],
            "metrics": self.metrics,
            "steps": self.steps,
            "server_delay": self.server_delay,
            "instance": self.instance.to_dict(),
        }

    def to_json(self):
        return json.dumps(self.to_dict())
    def __str__(self):
        return self.to_json()
    def __repr__(self):
        return self.__str__()
