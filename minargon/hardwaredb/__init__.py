from minargon import app
from werkzeug.routing import BaseConverter
from flask import abort
from functools import wraps
import urllib2

class HWSelector:
    def __init__(self, table, column, value):
        self.table = table
        self.column = column
        self.value = value

    def to_url(self):
        return "%s:%s:%s" % (self.table, self.column, self.value)


class HWSelectorConverter(BaseConverter):
    def to_python(self, value):
        return HWSelector(*value.split(":"))

    def to_url(self, selector):
        return selector.to_url()

class HWSelectorListConverter(BaseConverter):
    def to_python(self, values):
        return [HWSelector(*value.split(":")) for value in values.split(",")]

    def to_url(self, selectors):
        return ",".join([s.to_url() for s in selectors])

class HardwareDBConnectionError:
    def __init__(self, err):
        self.err = err
        self.msg = "Error accessing hardware DB: %s" % str(err.reason)
        self.name = "Hardware DB"
        self.front_end_abort = True

    def message(self):
        return self.msg

    def database_name(self):
        return self.name

# Decorator which handles and HardwareDB related access errors
def hardwaredb_route(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
            try:
                return func( *args, **kwargs)
            except (urllib2.HTTPError, urllib2.URLError) as err:
                return abort(503, HardwareDBConnectionError(err))
    return wrapper

hw_mappings = {}
hw_selectors = {}
def select(hw_select):
    if hw_select.table in hw_selectors:
        return hw_selectors[hw_select.table](hw_select.column, hw_select.value)
    return abort(404)

def channel_map(hw_select, channels):
    if hw_select.table in hw_mappings and hw_select.column in hw_mappings[hw_select.table]:
        return hw_mappings[hw_select.table][hw_select.column](hw_select.column, hw_select.value)
    return None

if app.config["FRONT_END"] == "icarus":
    import icarus.tpc
    hw_selectors = icarus.tpc.SELECTORS

    hw_mappings = icarus.tpc.MAPPINGS
