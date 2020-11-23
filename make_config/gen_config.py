from __future__ import absolute_import
import json
import redis
import argparse

def gen_config(config):
    # setup args for redis
    parse = argparse.ArgumentParser()
    parse.add_argument("-s", "--server", default="localhost")
    parse.add_argument("-p", "--port", type=int, default=6379)
    parse.add_argument("-ps", "--password", default=None)
    args = parse.parse_args()

    r = redis.Redis(host=args.server, port=args.port, password=args.password)

    redis_config = {}
    redis_config["metric_config"] = config["metrics"]
    for name, conf in redis_config["metric_config"].items():
        redis_config["metric_config"][name]["name"] = name
    redis_config["streams"] = config["streams"]

    for group, instances in config["groups"].items():
        r.set("GROUP_CONFIG:%s" % group, json.dumps(redis_config))
        r.delete("GROUP_MEMBERS:%s" % group)
        for i in instances:
            r.rpush("GROUP_MEMBERS:%s" % group, str(i))
