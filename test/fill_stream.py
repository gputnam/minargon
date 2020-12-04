from __future__ import absolute_import
import argparse
import redis
import time

r = redis.Redis()

def main(args):
    while 1:
        pipeline = r.pipeline()
        for stream in args.stream:
            pipeline.xadd(stream, {"dat": args.value})
        [_ for _ in pipeline.execute()]
        time.sleep(args.timeout)

def comma_list(inp):
    return [x for x in inp.split(",") if len(x) > 0]

if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("-s", "--stream", required=True, type=comma_list)
    args.add_argument("-t", "--timeout", default=1, type=float)
    args.add_argument("-v", "--value", default=1, type=float)
 
    main(args.parse_args())


