from minargon import app
import redis
from flask import send_file
import io
from minargon.metrics.online_metrics import redis_route
from minargon.metric.redis_api import get_streams

@app.route('/<rconnect>/print_last')
@redis_route
def print_last(rconnect):
    # get the last value from the "example" stream and print it
    last = get_streams(rconnect, ["example"], n_data=1)
    print last
