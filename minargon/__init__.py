# from gevent import monkey
# monkey.patch_all()
from __future__ import absolute_import
from flask.app import Flask

import os

class ReverseProxied(object):
    '''Wrap the application in this middleware and configure the 
    front-end server to add these headers, to let you quietly bind 
    this to a URL other than / and to an HTTP scheme that is 
    different than what is used locally.

    In nginx:
    location /myprefix {
        proxy_pass http://192.168.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Scheme $scheme;
        proxy_set_header X-Script-Name /myprefix;
        }

    :param app: the WSGI application
    '''
    def __init__(self, app, web_root):
        self.app = app
        self.web_root = web_root

    def __call__(self, environ, start_response):
        script_name = self.web_root
        if script_name:
            environ['SCRIPT_NAME'] = script_name
            path_info = environ['PATH_INFO']
            if path_info.startswith(script_name):
                environ['PATH_INFO'] = path_info[len(script_name):]

        scheme = environ.get('HTTP_X_SCHEME', '')
        if scheme:
            environ['wsgi.url_scheme'] = scheme
        return self.app(environ, start_response)

app = Flask(__name__)

app.config.from_envvar('MINARGON_SETTINGS', silent=False)

if not "WEB_ROOT" in app.config:
    app.config["WEB_ROOT"] = ""

# pass the location of the web root
app.wsgi_app = ReverseProxied(app.wsgi_app, app.config["WEB_ROOT"])

# set location of tempaltes
app.template_folder = "templates"

# url converters
from .tools import ListConverter, StreamConverter
app.url_map.converters['list'] = ListConverter
app.url_map.converters['stream'] = StreamConverter

from .hardwaredb import HWSelectorConverter, HWSelectorListConverter
app.url_map.converters["hw_selector"] = HWSelectorConverter
app.url_map.converters["hw_selector_list"] = HWSelectorListConverter
# load in the hardwaredb
from . import hardwaredb

# routes
if app.config["FRONT_END"] == "sbnd":
    import minargon.views.sbnd.views
elif app.config["FRONT_END"] == "icarus":
    import minargon.views.icarus.views
# common views
import minargon.views.common.views
# context processor
import minargon.views.common.inject
# custim error handling
import minargon.views.common.error

import minargon.metrics.online_metrics
import minargon.metrics.postgres_api
#import minargon.online

# load lua scripts for redis
app.config["LUA_ASSETS"] = {}
thisdir = os.path.dirname(os.path.abspath(__file__))
redis_asset_dir = os.path.join(thisdir, "metrics/" , "redis-lua/")
for fname in os.listdir(redis_asset_dir):
    if fname.endswith(".lua"):
        with open(os.path.join(redis_asset_dir, fname)) as f:
            app.config["LUA_ASSETS"][fname[:-4]] = f.read()
