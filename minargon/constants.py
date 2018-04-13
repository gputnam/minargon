# Detector Stuff

# FOR TESTING ON NEVIS DATA
"""
N_CHANNELS = 16
N_CHANNELS_PER_FEM = 16
N_FEM_PER_BOARD = 1
N_BOARDS = 1
"""
# FOR TESTING ON LAriaT DATA
N_CHANNELS = 480
N_CHANNELS_PER_FEM = 16
N_FEM_PER_BOARD = 4
N_BOARDS = 8

# For Lariat
N_WIRES_PER_PLANE = 240

detector = {
  'n_channels': N_CHANNELS,
  'n_channel_per_fem': N_CHANNELS_PER_FEM,
  'n_fem_per_board': N_FEM_PER_BOARD,
  'n_boards': N_BOARDS,
  'induction': {
     'offset': 0,
     'n_wires': N_WIRES_PER_PLANE,
   },
  'collection': {
     'offset': N_WIRES_PER_PLANE,
     'n_wires': N_WIRES_PER_PLANE,
   },
   'combined': {
     'offset': 0,
     'n_wires': N_WIRES_PER_PLANE * 2,
   }
}

# Redis Stuff
REDIS_TIME_STEPS = [1, 10]
# Each entry in this list should have a corresponding entry in 
# static/js/minargon/Data.js 'var DATA_TYPES' describing how the datum is 
# presented on the front-end
CHANNEL_DATA = ["rms", "baseline", "hit_occupancy", "pulse_height"] 

# same as for channel data
FEM_DATA = CHANNEL_DATA + ["frame_no", "event_no", "trigframe_no", "scaled_sum_rms"]
BOARD_DATA = CHANNEL_DATA + [] # other stuff to be included

# and for power supplies stuff
POWER_SUPPLY_DATA = ["measured_output_voltage", "measured_output_current", "output_voltage", "output_current", "max_output_current"]

# different time steps for power supply data
REDIS_POWER_SUPPLY_TIME_STEPS = [10]

