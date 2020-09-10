from minargon import app

from minargon.hardwaredb.icarus.tpc import TPCs

@app.context_processor
def inject_tpcs():
    return dict(TPCs=TPCs)
