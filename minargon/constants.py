# Detector Stuff
N_CHANNELS = 16
N_CHANNELS_PER_FEM = 16

# Redis Stuff
REDIS_TIME_STEPS = [1, 10]
# Each entry in this list should have a corresponding entry in 
# static/js/minargon/Data.js 'var DATA_TYPES' describing how the datum is 
# presented on the front-end
CHANNEL_DATA = ["rms", "baseline"] 
