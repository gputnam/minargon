from __future__ import absolute_import
from gen_config import gen_config
from six.moves import range

CONFIG = {
  "groups": {
    "wireplane": list(range(0, 10)),
  },
  "streams": ["example"],
  "metrics": {
    "rms": {},
    "hit_occupancy": {}
  }
}

gen_config(CONFIG)


