from __future__ import absolute_import
from __future__ import print_function
import gevent
from gevent import monkey
monkey.patch_socket()

import redis

r = redis.Redis()

def fetch_get():
    print(r.get("key"))

def fetch_wait():
    print(r.xread({"stream": 0}, block=0))

def printer():
    print("RANNN!")

threads = [
  gevent.spawn(fetch_get),
  gevent.spawn(fetch_wait),
  gevent.spawn(printer),
]

gevent.joinall(threads)



