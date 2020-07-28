from DataLoader import DataQuery
from minargon.hardwaredb import HWSelector

queryUrl = "https://dbdata0vm.fnal.gov:9443/QE/hw/app/SQ/query" 
db_name = "icarus_hardware_dev"
daq_columns = ["readout_board_id", "chimney_number", "readout_board_slot", "plane", "cable_label_number", "channel_type"]
daq_table = "daq_channels"

flange_columns = ["flange_pos_at_chimney", "tpc_id"]
flange_table = "flanges"
readout_table = "readout_boards"

def to_column(s):
    return s.replace(" ", "_").lower()

def to_display(s):
    return s.replace("_", " ").title() \
      .replace("Tpc", "TPC") \
      .replace("Id", "ID")

def flatten(l):
    return [item for sublist in l for item in sublist]

def available_values(table, column):
    dataQuery = DataQuery(queryUrl)
    # make unique and ignore duplicates
    data = list(set([x for x in dataQuery.query(db_name, table, to_column(column)) if x]))
    # if numeric, sort
    try:
        sorted_data = sorted(data, key=int)
    except:
        sorted_data = data
    return [HWSelector(table, column, d) for d in sorted_data]

def daq_channel_list(column, condition):
    dataQuery = DataQuery(queryUrl)
    channels = dataQuery.query(db_name, daq_table, "channel_id", 
        to_column(column) + ':eq:%s' % condition)
    channels = sorted([int(c) for c in channels if c], key=int)
    return channels

def flange_channel_list(column, condition):
    dataQuery = DataQuery(queryUrl)
    flange_ids = dataQuery.query(db_name, flange_table, "flange_id", 
        to_column(column) + ':eq:%s' % condition)
    # flange ids to readout board ids
    # readout board ids to daq 
    readout_board_ids = flatten([dataQuery.query(db_name, readout_table, "readout_board_id", "flange_id:eq:%s" % f) for f in flange_ids if f])

    daq_channel_ids = flatten([dataQuery.query(db_name, daq_table, "channel_id", "readout_board_id:eq:%s" % r) for r in readout_board_ids if r])
    
    # sort the channels
    daq_channels = sorted([int(c) for c in daq_channel_ids if c], key=int)

    return daq_channels

def slot_local_channel_map(column, condition):
    dataQuery = DataQuery(queryUrl)
    flange_ids = dataQuery.query(db_name, flange_table, "flange_id", 
        to_column(column) + ':eq:%s' % condition)
    # flange ids to readout board ids
    # readout board ids to daq 
    readout_board_ids = flatten([dataQuery.query(db_name, readout_table, "readout_board_id", "flange_id:eq:%s" % f) for f in flange_ids if f])

    # get the info
    daq_channel_info = flatten([dataQuery.query(db_name, daq_table, "channel_id,channel_number,readout_board_slot", "readout_board_id:eq:%s" % r) for r in readout_board_ids if r])
    
    # sort the channels
    daq_channel_info = sorted([c.split(",") for c in daq_channel_info if c], key=lambda x: int(x[0]))
    # map
    daq_channels = [int(r[1]) + 64*int(r[2]) for r in daq_channel_info]
    return daq_channels

# build the list of available selectors
def available_selectors():
    ret = {}
    ret[daq_table] = dict([(to_display(c), available_values(daq_table, c)) for c in daq_columns])
    ret[flange_table] = dict([(to_display(c), available_values(flange_table, c)) for c in flange_columns])
    return ret

# what functions are available
SELECTORS = {}
SELECTORS[daq_table] = daq_channel_list
SELECTORS[flange_table] = flange_channel_list

MAPPINGS = {}
MAPPINGS[flange_table] = {}
MAPPINGS[flange_table]["flange_pos_at_chimney"] = slot_local_channel_map
