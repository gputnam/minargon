class D3DataPoll {
    // expects a D3DataLink or D3DataChain
    constructor(data, timeout, listeners, update_function) {
        this.data = data;
        this.timeout = timeout;
        this.listeners = listeners;
        this.running = true;
        this.update_function = update_function;
    }

    run() {
        if (!(this.running == true)) {
            return;
        }

        if (!(this.update_function === undefined) && !this.update_function()) {
            setTimeout(this.run.bind(this), this.timeout);
            return;
        }
            
        var self = this;
        var start = new Date();
        start.setSeconds(start.getSeconds() - 10);
        this.data.get_data_promise(start, null, 10000)
            .then(function(value) {
                for (var i = 0; i < self.listeners.length; i++) {
                    var func = self.listeners[i];
                    func(value, start);
                }
            });
        setTimeout(this.run.bind(this), this.timeout);
    }

    stop() {
        this.running = false;
    }

    name() {
        return this.data.name();
    }
}

class D3DataChain {
  // expects a list of DataLinks and a final operation which 
  // composes the links into a final result
  constructor(data_links, name, operation) {
    this.data_links = data_links;
    this.local_name = name;
    if (operation === undefined) {
      this.operation = function(x) { return x; }
    }
    else {
      this.operation = operation;
    }
  }

  // Same interface as D3DataLink
  get_data(start, stop, step, d3_callback) {
    return Promise.all(this.data_links.map(function(iter_data_link) {
       return iter_data_link.get_data_promise(start, stop, step);
    }))
      .then(values => d3_callback(null, this.operation(values)));
//            error => d3_callback(new Error("unable to load data")));
  }
  
  get_data_promise(start, stop, step) {
      return Promise.all(this.data_links.map(function(iter_data_link) {
         return iter_data_link.get_data_promise(start, stop, step);
       }))
          .then(values => Promise.resolve(values.map(v => this.operation(v))));
               // error => reject(error));
  }

  map_operation(values) {
    var n_streams = values.length;
    var n_data_points = values[0].length;
    var ret = [];
    for (var i = 0; i < n_data_points; i++) { 
      var fail = false;
      var data_at_point = [];
      for (var j = 0; j < n_streams; j++) {
        if (values[j][i] === 0) { 
          ret.push(0);
          fail = true;
          break;
        }
        data_at_point.push(values[j][i]);
      }
      if (!fail) {
        ret.push(this.operation(data_at_point));
      }
    }
  }
 
  name() {
    if (this.local_name === undefined || this.local_name === null) {
      return this.data_links[0].name();
    }
    else {
      return this.local_name;
    }
  }
}

class D3DataLink {
  // takes as input a class which must implement the interface defined
  // by ChannelLink below.
  constructor(link_builder, name, operation) {
    this.link_builder = link_builder;
    this.local_name = name;
    if (operation === undefined) {
      this.operation = function(x) { return x; }
    }
    else {
      this.operation = operation;
    }
  }

  get_data(start, stop, step, d3_callback) {
     var self = this;
     return d3.json(self.link_builder.data_link(start, stop, step),
	function(err, data) {
	    if (!data) {
                console.log(data);
                console.log(err);
                return d3_callback(new Error('unable to load data'));
            }
	    return d3_callback(null,self.map_operation(data.values));
	});
  }
  
  get_data_promise(start, stop, step) {
    // Magic Javascript garbage
    var self = this;
    return new Promise(function(resolve, reject) {
      d3.json(self.link_builder.data_link(start, stop, step), function(data) {
        resolve(self.map_operation(data.values));
     });
     });
  }

  name(new_name) {
    if (new_name === undefined) {
        if (this.local_name === null || this.local_name === undefined) {
          return this.link_builder.name();
        }
        else {
          return this.local_name;
        }
    }
    else {
        this.local_name = new_name;
        return this;
    }
  }

  map_operation(values) {
    var self = this;
    return values.map(function(v) {
      if (v == 0) return 0;
      return self.operation(v);
    }); 

  }
}

// pass to D3DataLink to get stuff
class ChannelLink {
  constructor(script_root, data_name, channel_no) {
    this.data_name = data_name;
    this.channel_no = channel_no;
    this.root = script_root;
  }

  data_link(start, stop, step) {
    var args = $.param(timeArgs(start, stop, step));
    var stream = getDaqStream(step); 

    return this.root + '/wire_stream/' + stream + '/' + this.data_name + '/' + this.channel_no +'?' + args;
  }
  name() {
    return this.data_name;
  }
}

// pass to D3DataLink to get stuff
class FEMLink {
    constructor(script_root, data_name, crate, fem) {
        this.data_name = data_name;
        this.crate = crate;
        this.fem = fem;
        this.root = script_root;
    }

    data_link(start, stop, step) {
        var stream = getDaqStream(step);
        var args = $.param(timeArgs(start, stop, step));

        return this.root + '/stream/' + stream + '/' + this.data_name + '/' + this.crate + '/' + this.fem + '?' + args;
    }
    name() {
        return this.data_name;
    }
}

// pass to D3DataLink to get stuff
class CrateLink {
    constructor(script_root, data_name, crate) {
        this.data_name = data_name;
        this.crate = crate;
        this.root = script_root;
    }

    data_link(start, stop, step) {
        var stream = getDaqStream(step);
        var args = $.param(timeArgs(start, stop, step));

        return this.root + '/stream/' + stream + '/' + this.data_name + '/' + this.crate + '?' + args;
    }
    name() {
        return this.data_name;
    }
}

// Link to data on a power supply
class PowerSupplyLink {
    constructor(script_root, data_name, supply_name) {
        this.root = script_root;
        this.data_name = data_name;
        this.supply_name = supply_name;
    }

    data_link(start, stop, step) {
        var stream = getPowerStream(step);
        var args = $.param(timeArgs(start, stop, step));
        return this.root + '/power_stream/' + stream + '/' + this.data_name + '/' + this.supply_name + '?' + args;
    }
 
    name() {
        return this.data_name;
    }
}

// link to query a single time stamp from a bunch of wires
// Whereas the previous links are to query data over a bunch of time
// values for 1 wire/board/power supply, this querries a bunch of wires
// over 1 time value.
class MultiWireLink {
    constructor(script_root, data_name, wire_start, wire_end) {
        this.root = script_root;
        this.data_name = data_name;
        this.wire_start = wire_start;
        this.wire_end = wire_end;
    }
    data_link(start, stop, step) {
        // this doesn't use stop, so it should be null
        var stream = getDaqStream(step);
        return this.root + '/wire_query/' + stream + '/' + this.data_name + '/' + this.wire_start + '/' + this.wire_end;
    }
 
    name() {
        return this.data_name;
    }
}

// what redis stream you should be subscribing to
// TODO: implement
function getDaqStream(step) {
    return step / 1000;
}

function getPowerStream(step) {
    return step / 1000;
}

function timeArgs(start, stop, step) {
  var ret = {
   start: start.toISOString(),
   step: step,
   now: new Date().toISOString()
 };
  // stop can be null
  if (stop != null) {
    ret.stop = stop.toISOString();
  }
  return ret;

}

// definitions of important stuff for different data inputs
var CHANNEL_DATA_TYPES = {}

CHANNEL_DATA_TYPES["rms"] = {
  range: [0, 10],
  data_link: function(script_root, channel_no) { return new D3DataLink(new ChannelLink(script_root, "rms", channel_no)) },
};

CHANNEL_DATA_TYPES["hit_occupancy"] = {
  range: [0, 1],
  horizon_format: function(d) { return clean_format(d, percent_format); },
  data_link: function(script_root, channel_no) { return new D3DataLink(new ChannelLink(script_root, "hit_occupancy", channel_no)) },
};

CHANNEL_DATA_TYPES["baseline"] = {
  range: [-10, 10],
  horizon_format: function(d) { return clean_format(d, float_format); },
  data_link: function(script_root, channel_no) { return new D3DataLink(new ChannelLink(script_root, "baseline", channel_no)) },
};

CHANNEL_DATA_TYPES["pulse_height"] = {
  range: [0, 50],
  data_link: function(script_root, channel_no) { return new D3DataLink(new ChannelLink(script_root, "pulse_height", channel_no)) },
};

CHANNEL_DATA_TYPES["next_channel_dnoise"] = {
  range: [0, 2],
  data_link: function(script_root, channel_no) { return new D3DataLink(new ChannelLink(script_root, "next_channel_dnoise", channel_no)) },
};

var FEM_DATA_TYPES = {};

FEM_DATA_TYPES["pulse_height"]  = {
  range: CHANNEL_DATA_TYPES.pulse_height.range,
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "pulse_height", crate, fem)) },
};

FEM_DATA_TYPES["rms"]  = {
  range: CHANNEL_DATA_TYPES.rms.range,
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "rms", crate, fem)) },
};

FEM_DATA_TYPES["baseline"]  = {
  range: CHANNEL_DATA_TYPES.baseline.range,
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "baseline", crate, fem)) },
};

FEM_DATA_TYPES["hit_occupancy"] = {
  range: CHANNEL_DATA_TYPES.hit_occupancy.range,
  horizon_format: CHANNEL_DATA_TYPES.hit_occupancy.horizon_format,
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "hit_occupancy", crate, fem)) },
};

FEM_DATA_TYPES["next_channel_dnoise"] = {
  range: CHANNEL_DATA_TYPES.next_channel_dnoise.range,
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "next_channel_dnoise", crate, fem)) },
};

var NEVIS_HEADER_DATA_TYPES = {};

NEVIS_HEADER_DATA_TYPES["frame_no"] = {
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "frame_no", crate, fem)) },
};
NEVIS_HEADER_DATA_TYPES["event_no"] = {
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "event_no", crate, fem)) },
};
NEVIS_HEADER_DATA_TYPES["trig_frame_no"] = {
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "trigframe_no", crate, fem)) },
};
NEVIS_HEADER_DATA_TYPES["blocks"] = {
  data_link: function(script_root, crate, fem) { return new D3DataLink(new FEMLink(script_root, "blocks", crate, fem)) },
};

var CRATE_DATA_TYPES = {};

CRATE_DATA_TYPES["pulse_height"]  = {
  range: CHANNEL_DATA_TYPES.pulse_height.range,
  data_link: function(script_root, crate) { return new D3DataLink(new CrateLink(script_root, "pulse_height", crate)) },
};

CRATE_DATA_TYPES["rms"]  = {
  range: CHANNEL_DATA_TYPES.rms.range,
  data_link: function(script_root, crate) { return new D3DataLink(new CrateLink(script_root, "rms", crate)) },
};

CRATE_DATA_TYPES["baseline"]  = {
  range: CHANNEL_DATA_TYPES.baseline.range,
  data_link: function(script_root, crate) { return new D3DataLink(new CrateLink(script_root, "baseline", crate)) },
};

CRATE_DATA_TYPES["hit_occupancy"] = {
  range: CHANNEL_DATA_TYPES.hit_occupancy.range,
  horizon_format: CHANNEL_DATA_TYPES.hit_occupancy.horizon_format,
  data_link: function(script_root, crate) { return new D3DataLink(new CrateLink(script_root, "hit_occupancy", crate)) },
};

CRATE_DATA_TYPES["next_channel_dnoise"] = {
  range: CHANNEL_DATA_TYPES.next_channel_dnoise.range,
  data_link: function(script_root, crate) { return new D3DataLink(new CrateLink(script_root, "next_channel_dnoise", crate)) },
};

var POWER_SUPPLY_DATA_TYPES = {}

POWER_SUPPLY_DATA_TYPES["measured_output_voltage"] = {
  range: [40, 50],
  data_link: function(script_root, power_supply) { return new D3DataLink(new PowerSupplyLink(script_root, "measured_output_voltage", power_supply)) },
};

POWER_SUPPLY_DATA_TYPES["output_voltage"] = {
  range: [40, 50],
  data_link: function(script_root, power_supply) { return new D3DataLink(new PowerSupplyLink(script_root, "output_voltage", power_supply)) },
};

POWER_SUPPLY_DATA_TYPES["measured_output_current"] = {
  range: [0, 8],
  data_link: function(script_root, power_supply) { return new D3DataLink(new PowerSupplyLink(script_root, "measured_output_current", power_supply)) },
};

POWER_SUPPLY_DATA_TYPES["output_current"] = {
  range: [6, 8],
  data_link: function(script_root, power_supply) { return new D3DataLink(new PowerSupplyLink(script_root, "output_current", power_supply)) },
};

POWER_SUPPLY_DATA_TYPES["max_output_current"] = {
  range: [12, 20],
  data_link: function(script_root, power_supply) { return new D3DataLink(new PowerSupplyLink(script_root, "max_output_current", power_supply)) },
};


