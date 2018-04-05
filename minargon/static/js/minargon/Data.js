class D3DataChain {
  // expects a list of DataLinks and a final operation which 
  // composes the links into a final result
  constructor(data_links, operation, name) {
    this.operation = operation;
    this.data_links = data_links;
    this.local_name = name;
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
          .then(values => resolve(values.map(v => this.operation(v))));
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
    constructor(script_root, data_name, card, fem) {
        this.data_name = data_name;
        this.card = card;
        this.fem = fem;
        this.root = script_root;
    }

    data_link(start, stop, step) {
        var stream = getDaqStream(step);
        var args = $.param(timeArgs(start, stop, step));

        return this.root + '/stream/' + stream + '/' + this.data_name + '/' + this.card + '/' + this.fem + '?' + args;
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

// what redis stream you should be subscribing to
// TODO: implement
function getDaqStream(step) {
    return step / 1000;
}

function getPowerStream(step) {
    return step / 1000;
}

function timeArgs(start, stop, step) {
  return {
   start: start.toISOString(),
   stop: stop.toISOString(),
   step: step,
   now: new Date().toISOString()
 };

}

// definitions of important stuff for different data inputs
var CHANNEL_DATA_TYPES = {}

CHANNEL_DATA_TYPES["rms"] = {
  default_thresholds: [0, 5],
  data_link: function(script_root, channel_no) { return new D3DataLink(new ChannelLink(script_root, "rms", channel_no)) },
};

CHANNEL_DATA_TYPES["hit_occupancy"] = {
  default_thresholds: [0, 1],
  data_link: function(script_root, channel_no) { return new D3DataLink(new ChannelLink(script_root, "hit_occupancy", channel_no)) },
};

CHANNEL_DATA_TYPES["baseline"] = {
  default_thresholds: [700, 900], 
  data_link: function(script_root, channel_no) { return new D3DataLink(new ChannelLink(script_root, "baseline", channel_no)) },
};

var FEM_DATA_TYPES = {};

FEM_DATA_TYPES["rms"]  = {
  default_thresholds: [0, 5],
  data_link: function(script_root, card, fem) { return new D3DataLink(new FEMLink(script_root, "rms", card, fem)) },
};

FEM_DATA_TYPES["baseline"]  = {
  default_thresholds: [700, 900],
  data_link: function(script_root, card, fem) { return new D3DataLink(new FEMLink(script_root, "baseline", card, fem)) },
};

FEM_DATA_TYPES["hit_occupancy"] = {
  default_thresholds: [0, 1],
  data_link: function(script_root, card, fem) { return new D3DataLink(new FEMLink(script_root, "hit_occupancy", card, fem)) },
};

var POWER_SUPPLY_DATA_TYPES = {}

POWER_SUPPLY_DATA_TYPES["output_voltage"] = {
  default_thresholds: [40, 50],
  data_link: function(script_root, power_supply) { return new D3DataLink(new PowerSupplyLink(script_root, "output_voltage", power_supply)) },
};

POWER_SUPPLY_DATA_TYPES["output_current"] = {
  default_thresholds: [6, 8],
  data_link: function(script_root, power_supply) { return new D3DataLink(new PowerSupplyLink(script_root, "output_current", power_supply)) },
};

POWER_SUPPLY_DATA_TYPES["max_output_current"] = {
  default_thresholds: [12, 20],
  data_link: function(script_root, power_supply) { return new D3DataLink(new PowerSupplyLink(script_root, "max_output_current", power_supply)) },
};


