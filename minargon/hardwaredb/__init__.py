from __future__ import absolute_import
from minargon import app
from werkzeug.routing import BaseConverter
from flask import abort, g
from functools import wraps
import sqlite3
import os

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
        self.msg = "Error accessing hardware DB: %s" % str(err)
        self.name = "Hardware DB"
        self.front_end_abort = True

    def message(self):
        return self.msg

    def database_name(self):
        return self.name

def get_hw_db(db_name, db_file):
    db = getattr(g, '_sqlite_%s' % db_name, None)
    if db is None:
        fd = os.open(db_file, os.O_RDONLY)
        db = sqlite3.connect('/dev/fd/%d' % fd)
        os.close(fd)
        setattr(g, '_sqlite_%s' % db_name, db)
    return db

@app.teardown_appcontext
def close_sqlite_connections(exception):
    for connection_name in app.config["SQLITE_INSTANCES"]: 
        db = getattr(g, '_sqlite_%s' % connection_name, None)
        if db is not None:
            db.close()

# Decorator which handles and HardwareDB related access errors
def hardwaredb_route(db_name):
    def hardwaredb_route_decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
                if db_name not in app.config["SQLITE_INSTANCES"]: 
                    return abort(404)
                conn = get_hw_db(db_name, app.config["SQLITE_INSTANCES"][db_name]["file"])
                if not isinstance(conn, sqlite3.Connection):
                    return abort(503, HardwareDBConnectionError(conn))
                try:
                    return func(conn, *args, **kwargs)
                except (sqlite3.OperationalError, sqlite3.ProgrammingError, sqlite3.InternalError, ValueError) as err:
                    return abort(503, HardwareDBConnectionError(err))
        return wrapper
    return hardwaredb_route_decorator

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
    #from . import icarus
    #from minargon import hardwaredb
    #from .hardwaredb import icarus
    from .icarus import tpc
    hw_selectors = icarus.tpc.SELECTORS

    hw_mappings = icarus.tpc.MAPPINGS
