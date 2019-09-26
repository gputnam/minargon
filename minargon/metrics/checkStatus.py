def statusString(val):
  mystring = val
  if val == "0":
    mystring = "Warming Up"
  elif val == "1":
    mystring = "Tracking Setup"
  elif val == "2":
    mystring = "Track to PPSREF"
  elif val == "3":
    mystring = "Synch to PPSREF"
  elif val == "4":
    mystring = "Free Run"
  elif val == "5":
    mystring = "PPSREF Unstable"
  elif val == "6":
    mystring = "PPSREF Lost"
  elif val == "7":
    mystring = "Freeze"
  elif val == "8":
    mystring = "Factory Used"
  elif val == "9":
    mystring = "Searching Rb Line"
  else:
    mystring = val

  return mystring

def oscillatorString(val):
  mystring = val
  if val == "0":
    mystring = "Warming Up"
  elif val == "1":
    mystring = "Free Run"
  elif val == "2":
    mystring = "Disciplined"
  else:
    mystring = "Undefined"

  return mystring


def messageString(val):
  mystring = val
  if val == "0":
    mystring = "Do not take account"
  elif val == "1":
    mystring = "Take account, no message"
  elif val == "2":
    mystring = "Take account, partially OK"
  elif val == "3":
    mystring = "Take account, all OK"
  else:
    mystring = val

  return mystring

def transferString(val):
  mystring = val
  if val == "0":
    mystring = "None"
  elif val == "1":
    mystring = "Manual"
  elif val == "2":
    mystring = "GPS old"
  elif val == "3":
    mystring = "GPS fresh"
  else:
    mystring = "Undefined"

  return mystring

