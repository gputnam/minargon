# Detector Stuff
N_CHANNELS = 16
N_CHANNELS_PER_FEM = 16
N_FEM_PER_BOARD = 1
N_BOARDS = 1

detector = {
  'n_channels': N_CHANNELS,
  'n_channel_per_fem': N_CHANNELS_PER_FEM,
  'n_fem_per_board': N_FEM_PER_BOARD,
  'n_boards': N_BOARDS,
}

# Redis Stuff
REDIS_TIME_STEPS = [1, 10]
# Each entry in this list should have a corresponding entry in 
# static/js/minargon/Data.js 'var DATA_TYPES' describing how the datum is 
# presented on the front-end
CHANNEL_DATA = ["rms", "baseline", "hit_occupancy"] 

# same as for channel data
FEM_DATA = CHANNEL_DATA + [] # other stuff to be included

# and for power supplies stuff
POWER_SUPPLY_DATA = ["output_voltage", "output_current", "max_output_current"]

# different time steps for power supply data
REDIS_POWER_SUPPLY_TIME_STEPS = [100]

