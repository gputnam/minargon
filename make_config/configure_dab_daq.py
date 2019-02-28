from gen_config import gen_config

CONFIG = {
  "groups": {
    "DABBoardReader": ["pmt%i" % i for i in range(4)] + ["pmtx%i" % i for i in range(4)]
  },
  "streams": ["10s", "5m"],
  "metrics": {
    'BoardReader0Avg_Output_Wait_Time': {},
    'BoardReader0Data_Send_Count_to_Rank_1': {},
    'artdaqDriverEvents_Released_to_art_this_run': {},
    'artdaqDriverEvent_Rate': {},
    'artdaqDriverShared_Memory_Reading_Buffers': {},
    'artdaqDriverShared_Memory_Pending_Buffers': {},
    'BoardReader0Data_Send_Count_to_Rank_-1111': {},
    'artdaqDriverAverage_Event_Size': {},
    'artdaqDriverShared_Memory_Available_Buffers': {},
    'artdaqDriverRun_Number': {},
    'BoardReader0Average_Fragment_Size': {},
    'artdaqDriverIncomplete_Events_Released_to_art_this_subrun': {},
    'BoardReader0Fragment_Count': {},
    'BoardReader0Avg_BoardReader_Sync_Wait_Time': {},
    'artdaqDriverIncomplete_Events_Released_to_art_this_run': {},
    'artdaqDriverShared_Memory_Full_%': {},
    'artdaqDriverShared_Memory_Full_Buffers': {},
    'artdaqDriverEvents_Released_to_art_this_subrun': {},
    'artdaqDriverLast_Timestamp': {},
    'BoardReader0Data_Rate': {},
    'BoardReader0Avg_Input_Wait_Time': {},
    'artdaqDriverShared_Memory_Available_%': {},
    'BoardReader0Data_Send_Count_to_Rank_2': {},
    'artdaqDriverTokens_sent': {},
    'BoardReader0Fragment_Rate': {},
    'BoardReader0pmtx01Last_Timestamp': {},
  }
}

gen_config(CONFIG)


