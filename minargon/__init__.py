from gevent import monkey
monkey.patch_all()
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
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        script_name = '/cgi-bin/minargon/minargon.wsgi'
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

app.wsgi_app = ReverseProxied(app.wsgi_app)

# set location of tempaltes
app.template_folder = os.path.join(app.config["FRONT_END"], "templates")

# url converters
from .tools import ListConverter
app.url_map.converters['list'] = ListConverter

# routes
if app.config["FRONT_END"] == "sbnd":
    import minargon.sbnd.views
elif app.config["FRONT_END"] == "icarus":
    import minargon.icarus.views
import minargon.metrics.online_metrics
import minargon.metrics.postgres_api
