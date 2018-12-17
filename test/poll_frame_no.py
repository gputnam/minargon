import redis

RUN_RANGE = (304, 349)
FEM_RANGE = (0, 10)

def frame_key(run, sub_run, fem):
    return "stream/sub_run_%i:%i:frame_no:crate:0:fem:%i" % (run, sub_run, fem)


def print_result(run, sub_run, frame_no_set):
    result = "OK" if len(frame_no_set) == 1 else "BAD"
    print run, sub_run, result,
    for f in frame_no_set:
        print f,
    print "\n",
    

def main():
    r = redis.Redis()
    for run in range(*RUN_RANGE):
        run_keys = r.keys("stream/sub_run_%i:*:frame_no:crate:0*" % run)
        sub_run = 1
        while r.get(frame_key(run, sub_run, 5)) is not None: 
            frame_nos = []
            for fem in range(*FEM_RANGE): 
               frame_no = int(r.get(frame_key(run, sub_run, fem)))
               run_keys.remove(frame_key(run, sub_run, fem))
               assert(frame_no is not None)
               frame_nos.append(frame_no) 
            frame_no_set = set(frame_nos)
            print_result(run, sub_run, frame_no_set)
            sub_run += 1
        assert(len(run_keys) == 0)

if __name__ == "__main__":
    main()
