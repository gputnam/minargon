from __future__ import absolute_import
from minargon import app
import redis
from flask import send_file
import io
from minargon.metrics.online_metrics import redis_route

@app.route('/<rconnect>/binary/<keyname>.png')
@redis_route
def binary(rconnect, keyname):
    image_binary = rconnect.get(keyname)
    return send_file(io.BytesIO(image_binary), mimetype="image/png")
