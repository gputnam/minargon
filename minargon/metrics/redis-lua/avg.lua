-- Should load struct.lua before executing this

local funcs = {}

function funcs.struct_map(cname)
  if cname == "double" then 
    return "d"
  end
  if cname == "float" then
    return "f"
  end
  if cname == "uint8_t" then
    return "B"
  end
  if cname == "uint16_t" then
    return "H"
  end
  if cname == "uint32_t" then
    return "I"
  end
  if cname == "uint64_t" then
    return "L"
  end
  if cname == "int8_t" then
    return "b"
  end
  if cname == "int16_t" then
    return "h"
  end
  if cname == "int32_t" then
    return "i"
  end
  if cname == "int64_t" then
    return "l"
  end
  return nil
end

function funcs.dump(o)
   if type(o) == 'table' then
      local s = '{ '
      for k,v in pairs(o) do
         if type(k) ~= 'number' then k = '"'..k..'"' end
         s = s .. '['..k..'] = ' .. funcs.dump(v) .. ','
      end
      return s .. '} '
   else
      return tostring(o)
   end
end


function funcs.get_time(streamID)
    if type(streamID) ~= "string" then
      if type(streamID["ok"]) == "string" then
          streamID = streamID["ok"]
      else
          error("Expected string, got: " .. funcs.dump(streamID), 2)
      end 
    end

    local time, _ = string.match(streamID, "(.*)%-(.*)")
    return tonumber(time)
end

function funcs.to_output(stream)
    for i = 1, #stream do
        stream[i][2] = tostring(stream[i][2])
    end
    return stream
end

function funcs.finite(v)
    -- check if nil
    if v == nil then
        return false
    end
    -- check if NAN
    if v ~= v then
        return false
    end
    -- check finite
    if not (v < 1./0.) or not (v > -1. / 0.) then
       return false
    end
    return true
end

function funcs.do_average(streams)
    -- if we don't have enough keys to get the step, give up
    if #streams[1] < 2 then
      return {}
    end 

    -- each stream should have roughly the same average -- use the first to get the step
    local step = streams[1][1][1] - streams[1][2][1]

    -- setup the averager
    local average = {}

    -- setup the averaged table -- only take non-NAN values
    local i_avg = 1
    for i = 1, #streams[1] do
        if funcs.finite(streams[1][i][2]) then
            average[i_avg] = streams[1][i]
            i_avg = i_avg + 1
        end
    end
    

    local n_avg = {}
    for i = 1, #average do
      n_avg[i] = 1
    end

    for n = 2, #streams do
      local stream1_ind = 1 
      local streamN_ind = 1

      while stream1_ind <= #average and streamN_ind <= #streams[n] do
        local tdiff = average[stream1_ind][1] - streams[n][streamN_ind][1]

        -- ignore bad stream N values
        if not funcs.finite(streams[n][streamN_ind][2]) then
            streamN_ind = streamN_ind + 1
        -- stream N is ahead of stream 1
        -- push stream N down (streams are ordered newest -> oldest)
        elseif tdiff < - step / 2 then
            streamN_ind = streamN_ind + 1
        -- stream 1 is ahead of stream N
        -- push stream 1 down (streams are ordered newest -> oldest)
        elseif tdiff > step / 2 then
            stream1_ind = stream1_ind + 1
        -- these times correlate!
        else
            average[stream1_ind][2] = (average[stream1_ind][2] * n_avg[stream1_ind] + streams[n][streamN_ind][2]) / (n_avg[stream1_ind] + 1)
            n_avg[stream1_ind] = n_avg[stream1_ind] + 1
            -- onto the next time point
            streamN_ind = streamN_ind + 1
        end
      end
    end

    return average
end

local streamData = {}
for i = 1, #KEYS do
    streamData[i] = {}

    local thisStream = {}
    -- don't use negative count
    if tonumber(ARGV[3]) < 0 then
        thisStream = redis.call("XREVRANGE", KEYS[i], ARGV[1], ARGV[2]) 
    else
        thisStream = redis.call("XREVRANGE", KEYS[i], ARGV[1], ARGV[2], "COUNT", ARGV[3]) 
    end

    for j = 1, #thisStream do
      streamData[i][j] = {}

      streamData[i][j][1] = funcs.get_time(thisStream[j][1])

      local sname = funcs.struct_map(thisStream[j][2][1])
      if sname ~= nil then
        streamData[i][j][2] = struct.unpack(sname, thisStream[j][2][2])
      elseif thisStream[j][2][1] == "dat" then -- string repr
        streamData[i][j][2] = tonumber(thisStream[j][2][2])
      else
        streamData[i][j][2] = 0. / 0. -- NAN
      end
    end
end
local averaged = funcs.do_average(streamData)
averaged = funcs.to_output(averaged)
return averaged
