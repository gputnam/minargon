class D3DataPoll {
    // expects a D3DataLink or D3DataChain
    constructor(data, timeout, listeners, step, server_delay) {
        this.data = data;
        this.timeout = timeout;
        this.listeners = listeners;
        this.running = true;
        this.step = step;
        this.server_delay = server_delay;
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
        start.setSeconds(start.getSeconds() - this.server_delay);
        var stop = new Date(start);
        stop.setSeconds(stop.getSeconds() + this.step / 1e3); // ms -> s
        var now = new Date();
        this.data.get_data_promise(start, stop, this.step)
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
      .then(values => d3_callback(null, this.map_operation(values)));
//            error => d3_callback(new Error("unable to load data")));
  }

  get_values(start, stop, step, d3_callback)  {
    return Promise.all(this.data_links.map(function(iter_data_link) {
       return iter_data_link.get_data_promise(start, stop, step);
    }))
      .then(values => d3_callback(null, redisValues(this.map_operation(values))));
  }
  
  get_data_promise(start, stop, step) {
      return Promise.all(this.data_links.map(function(iter_data_link) {
         return iter_data_link.get_data_promise(start, stop, step);
       }))
          .then(values => Promise.resolve(this.map_operation(values)));
               // error => reject(error));
  }

  map_operation(data) {
    var n_streams = data.length;

    var ret_data = [];
    var indexes = [];

    for (var i = 0; i < n_streams; i++) { 
      ret_data.push(this.operation(data[i].values));
      indexes.push(data[i].index);
    }

    var ret = {}
    ret.index = indexes;
    ret.values = ret_data;
    return ret;
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
	    return d3_callback(null,self.map_operation(data));
	});
  }

  get_values(start, stop, step, d3_callback) {
     var self = this;
     return d3.json(self.link_builder.data_link(start, stop, step),
	function(err, data) {
	    if (!data) {
                console.log(data);
                console.log(err);
                return d3_callback(new Error('unable to load data'));
            }
	    return d3_callback(null, redisValues(self.map_operation(data)));
	});
  }
  
  get_data_promise(start, stop, step) {
    // Magic Javascript garbage
    var self = this;
    return new Promise(function(resolve, reject) {
      d3.json(self.link_builder.data_link(start, stop, step), function(data) {
        resolve(self.map_operation(data));
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

  map_operation(data) {
    var self = this;
    data.values = data.values.map(function(v) {
      if (v == 0) return 0;
      return self.operation(v);
    }); 
    return data;
  }
}

// gets the actual values out of a data object returned by the redis api
function redisValues(data) {
  return data.values
}

// what redis stream you should be subscribing to
// TODO: implement
function getDaqStream(step) {
    return step / 1000;
}

function getPowerStream(step) {
    return step / 1000;
}

