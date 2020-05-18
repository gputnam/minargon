
from DataLoader import DataQuery


queryUrl = "https://dbdata0vm.fnal.gov:9443/QE/hw/app/SQ/query" 
db_name = "icarus_hardware_dev"
columns = ["readout_board_id", "chimney_number", "readout_board_slot", "plane", "cable_label_number", "channel_type"]
table = "daq_channels"

def to_column(s):
    return s.replace(" ", "_").lower()

def to_display(s):
    return s.replace("_", " ").title()

def tpc_channel_list(column, condition):
    dataQuery = DataQuery(queryUrl)
    channels = dataQuery.query(db_name, table, "channel_id", 
        to_column(column) + ':eq:%s' % condition)
    # sort the channels
    channels = sorted([c for c in channels if c], key=int)
    return channels

def tpc_columns():
    return [to_display(c) for c in columns]

def tpc_available_values(column):
    dataQuery = DataQuery(queryUrl)
    # make unique and ignore duplicates
    data = list(set([x for x in dataQuery.query(db_name, table, to_column(column)) if x]))
    # if numeric, sort
    try:
        sorted_data = sorted(data, key=int)
    except:
        sorted_data = data
    return sorted_data

