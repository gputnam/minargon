from gen_config import gen_config

CONFIG = {
  "groups": {
    "wireplane": range(0, 10),
  },
  "streams": ["example"],
  "metrics": {
    "rms": {},
    "hit_occupancy": {}
  }
}

gen_config(CONFIG)


