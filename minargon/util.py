from werkzeug.routing import BaseConverter

class ListConverter(BaseConverter):
    def to_python(self, value):
        return [x for x in value.split(',') if len(x) > 0]
    def to_url(self, values):
        return ','.join(BaseConverter.to_url(value)
                        for value in values)
