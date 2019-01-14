import json

class TimeSeries(object):
    def __init__(self, instance, metric_config, **kwargs):
        self.name = instance.name
        self.instance_link = instance.link
        self.fields = instance.fields
        self.metric_config = metric_config
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
            "instance_link": self.instance_link,
            "metric_config": self.metric_config,
            "metric_list": [k for k,_ in self.metric_config.items()],
            "instance": self.instance.to_dict(),
            "fields": [f.to_dict() for f in self.fields],
         }

    def to_json(self, **kwargs):
        return json.dumps(self.to_dict(**kwargs))
    def __str__(self):
        return self.to_json()
    def __repr__(self):
        return self.__str__()

