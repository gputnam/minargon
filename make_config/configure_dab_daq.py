from gen_config import gen_config
import collections

CONFIG = {
  "groups": {
    "DABBoardReader": ["pmtx0%i" % i for i in range(1,5)] + ["pmt0%i" % i for i in range(1,5)]
  },
  "streams": ["10s", "5m"],
  "metrics": collections.OrderedDict(
      BoardReader0Data_Send_Count_to_Rank_2 = {},
      BoardReader0Avg_Output_Wait_Time = {},
      BoardReader0Avg_Input_Wait_Time = {},
      BoardReader0Fragment_Count = {},
      BoardReader0Average_Fragment_Size = {},
      BoardReader0Fragment_Rate = {},
      BoardReader0Data_Rate = {},
      BoardReader0pmtx01Last_Timestamp = {},
      BoardReader0Avg_BoardReader_Sync_Wait_Time = {},
  )
}

gen_config(CONFIG)


