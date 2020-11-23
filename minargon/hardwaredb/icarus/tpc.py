from __future__ import absolute_import
from minargon.hardwaredb import HWSelector, hardwaredb_route

db_name = "icarus_tpc_hw"
daq_columns = ["readout_board_id", "chimney_number", "readout_board_slot", "plane", "cable_label_number", "channel_type"]
daq_table = "daq_channels"

flange_columns = ["flange_pos_at_chimney", "tpc_id"]
flange_table = "flanges"
readout_table = "readout_boards"

# For now, hard-code this
# TODO: use caching or a faster DB so we don't have to do this
TPCs = ["WW", "WE", "EW", "EE"]

def to_column(s):
    return s.replace(" ", "_").lower()

def to_display(s):
    return s.replace("_", " ").title() \
      .replace("Tpc", "TPC") \
      .replace("Id", "ID")

def flatten(l):
    return [item for sublist in l for item in sublist]

@hardwaredb_route(db_name)
def available_values(conn, table, column):
    cur = conn.cursor()
    data = cur.execute("SELECT %s FROM %s" % (to_column(column), table))
    # make unique and ignore duplicates
    data = list(set([x[0] for x in data if x]))
    # if numeric, sort
    try:
        sorted_data = sorted(data, key=int)
    except:
        sorted_data = data
    cur.close()
    return [HWSelector(table, column, d) for d in sorted_data]

@hardwaredb_route(db_name)
def daq_channel_list(conn, column, condition):
    cur = conn.cursor()

    column = to_column(column)
    if column not in daq_columns:
       raise ValueError("Column (%s) is not an available selector in table %s" % (column, daq_table))

    channels = cur.execute("SELECT channel_id FROM %s WHERE %s=?" % (daq_table, column), (condition,))
    channels = sorted([int(c[0]) for c in channels if c], key=int)

    cur.close()
    return channels

@hardwaredb_route(db_name)
def flange_channel_list(conn, column, condition):
    cur = conn.cursor()

    column = to_column(column)
    if column not in flange_columns:
       raise ValueError("Column (%s) is not an available selector in table %s" % (column, flange_table))

    flange_ids = cur.execute("SELECT flange_id FROM %s WHERE %s=?" % (flange_table, column), (condition, ))
    # collect the flange ids into a selector
    flange_id_list = [str(f[0]) for f in flange_ids if f]
    flange_id_spec = "(" + ",".join(["?" for _ in flange_id_list]) + ")"

    readout_board_ids = cur.execute("SELECT readout_board_id FROM %s WHERE flange_id IN %s" % (readout_table, flange_id_spec), flange_id_list) 
    readout_board_list = [str(f[0]) for f in readout_board_ids if f]
    readout_board_spec = "(" + ",".join(["?" for _ in readout_board_list]) + ")"

    daq_channel_ids = cur.execute("SELECT channel_id FROM %s WHERE readout_board_id IN %s" % (daq_table, readout_board_spec), readout_board_list)
    # sort the channels
    daq_channels = sorted([int(c[0]) for c in daq_channel_ids if c], key=int)

    cur.close()
    return daq_channels

@hardwaredb_route(db_name)
def flange_list(conn, column, condition):
    cur = conn.cursor()

    column = to_column(column)
    if column not in flange_columns:
       raise ValueError("Column (%s) is not an available selector in table %s" % (column, flange_table))

    flange_ids = cur.execute("SELECT flange_pos_at_chimney FROM %s WHERE %s=?" % (flange_table,column), (condition,))
    flanges = [c[0] for c in flange_ids if c]

    cur.close()
    return flanges

@hardwaredb_route(db_name)
def slot_local_channel_map(conn, column, condition):
    cur = conn.cursor()

    column = to_column(column)
    if column not in flange_columns:
       raise ValueError("Column (%s) is not an available selector in table %s" % (column, flange_table))

    flange_ids = cur.execute("SELECT flange_id FROM %s WHERE %s=?" % (flange_table, to_column(column)), (condition,))
    # collect the flange ids into a selector
    # collect the flange ids into a selector
    flange_id_list = [str(f[0]) for f in flange_ids if f]
    flange_id_spec = "(" + ",".join(["?" for _ in flange_id_list]) + ")"

    readout_board_ids = cur.execute("SELECT readout_board_id FROM %s WHERE flange_id IN %s" % (readout_table, flange_id_spec), flange_id_list) 
    readout_board_list = [str(f[0]) for f in readout_board_ids if f]
    readout_board_spec = "(" + ",".join(["?" for _ in readout_board_list]) + ")"

    daq_channel_ids = cur.execute("SELECT channel_id,channel_number,readout_board_slot FROM %s WHERE readout_board_id IN %s" % (daq_table, readout_board_spec), readout_board_list)
    
    # sort the channels
    # daq_channel_info = sorted([c.split(",") for c in daq_channel_info if c], key=lambda x: int(x[0]))
    # map
    daq_channels = [int(r[1]) + 64*int(r[2]) for r in daq_channel_ids]

    cur.close()
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
SELECTORS[flange_table + "_flanges"] = flange_list

MAPPINGS = {}
MAPPINGS[flange_table] = {}
MAPPINGS[flange_table]["flange_pos_at_chimney"] = slot_local_channel_map
