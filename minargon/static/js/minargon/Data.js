import {CircularBuffer} from "./circular_buffer.js";
import {throw_database_error} from "./error.js";
import {throw_alert, remove_alert} from "./alert.js";

export class D3DataBuffer {
  // input:
  // poll: a D3DatSource or D3DataPoll object 
  //       NOTE: this class will reset the list of listeners attached to the passed in poll
  // n_data: the amount of data to keep around in each circular buffer
  // listeners: a list of functions to be called whenever any buffer updates. Each function will be passed as input a list of circular buffers,
  //            where the order of circular buffers is specified by the "accessor" variable as mentioned above.

  // NOTE: this class will store the data from each provided stream into a list of circular buffer objects. The ith circular buffer
  //       corresponds to the ith accessor list provided by the DataLink. 
  constructor(poll, n_data, listeners) {
    this.poll = poll;
    this.accessors = poll.accessors();
    this.buffers = [];
    this.n_data = n_data;
    for (var i = 0; i < this.accessors.length; i++) {
      this.buffers.push( new CircularBuffer(n_data) );
    }
    this.poll.listeners = [this.updateBuffers.bind(this)];
    this.listeners = listeners;

    // whether the buffer should be reset when new data shows up
    this.reset_buffers = false;

  }

  // start: start the Poll/Source and connect with the buffers
  start(start) {
    for (var i = 0; i < this.accessors.length; i++) {
      this.buffers[i].reset();
    }
    this.reset_buffers = false;
    this.poll.start(start, this.n_data);
  }

  // stop: stop the Poll/Source
  stop() {
    for (var i = 0; i < this.accessors.length; i++) {
      this.buffers[i].reset();
    }
    this.poll.stop();
  }

  getData(start, stop) {
    this.reset_buffers = true;
    this.poll.getData(start, stop);
  }

  isRunning() {
    return this.poll.isRunning();
  }


  // internal function which updates the managed circular buffers with new data
  updateBuffers(value) {
    if (this.reset_buffers) {
      for (var i = 0; i < this.accessors.length; i++) {
        this.buffers[i].reset(true); // set buffer to linear mode
      }
    }

    var data = value.values;

    for (var i = 0; i < this.accessors.length; i++) {
      var this_data = data;
      for (var k = 0; k < this.accessors[i].length; k++) {
        this_data = this_data[this.accessors[i][k]];
        if (this_data == undefined) {
          break;
        }
      }
      if (this_data === undefined) {
        continue;
      }
      for (var j = 0; j < this_data.length; j++) {
        // only push new data
        if (this.buffers[i].size == 0 || this.buffers[i].get_last()[0] < this_data[j][0]) {
          this.buffers[i].push(this_data[j]);
        }
      }
    }
    for (var i = 0; i < this.listeners.length; i++) {
      var func = this.listeners[i];
      func(this.buffers);
    }

  }
}

export class D3DataSource {
  // input:
  // link: a class following the interface defined in DataLink.js
  // timeout: (currently unused) the time (in milliseconds) after which the source will give up requesting data
  // listeners: a list of functions to be called with the data returned by the D3DataLink/Chain
  constructor(link, timeout, listeners) {
    this.link = link;
    this.timeout = timeout;
    this.listeners = listeners;
    this.source = null;
  }

  // expose the link's accessors
  accessors() {
    return this.link.accessors();
  }

  getData(start, stop) {
    var data = new D3DataLink(this.link, this.link.name());
    var self = this;
    data.get_data_promise(start, stop)
      .then(function(value) {
        for (var i = 0; i < self.listeners.length; i++) {
          var func = self.listeners[i];
          func(value);
        }
      })
      .catch(function(error) {
        throw_database_error(error, "source_data");
      });
  }

  start(start) {
    this.run(start);
  }

  // input:
  // start: the start index into each time series for the first call for data
  // behavior: starts up the D3DataSource -- sets up a persistent connection to the backend using SSE
  //           and on each update calls the list of listener functions
  run(start) {
    this.source = new EventSource(this.link.event_source_link(start));
    var self = this;
    this.source.onmessage = function(event) {
        var data = JSON.parse(event.data);
        for (var i = 0; i < self.listeners.length; i++) {
          var func = self.listeners[i];
          func(data);
        }
    };
  }

  isRunning() {
    if (this.source !== null) {
      return true;
    }
    else {
      return false;
    }
  }

  // behavior: stops the D3DataSource from running
  // NOTE: you should always call this function when deleting an old Source.
  // Otherwise, it will run forever
  stop() {
    if (this.source !== null) {
      this.source.close();
      this.source = null;
    }
  }

}

export class D3DataPoll {
    // input:
    // data: A D3DataLink or D3DataChain
    // timeout: the time difference (in milliseconds) between calls to the backend website
    // listeners: a list of functions to be called with the data returned by the D3DataLink/Chain
    constructor(data, timeout, listeners) {
        this.data = data;
        this.timeout = timeout;
        this.listeners = listeners;
        this.running = false;
    }

    // expose the data object accessors
    accessors() {
      return this.data.accessors();
    }

    getData(start, stop) {
      var self = this;
      var alertID = this.name().replace(/\s/g, '').replace(/:/g,'').replace(/_/g,'');
      var alertText = "Loading data for request (" + this.name() + ")";
      var timeout = setTimeout(function() { throw_alert(alertText, alertID);}, 3000);
      this.data.get_data_promise(start, stop)
        .then(function(value) {
          for (var i = 0; i < self.listeners.length; i++) {
            var func = self.listeners[i];
            func(value, false);
          }
        })
        .catch(function(error) {
          throw_database_error(error, "poll_get_data");
        })
        .finally(function() { clearTimeout(timeout); remove_alert(alertID); });
    }
    
    start(start, n_data) {
      this.running = true;
      this.run(start, n_data);
    }

    // input:
    // start: the start index into each time series for the first call to the D3DataLink/Chain
    // behavior: starts up the D3DataPoll -- repetitively polls the backend for data and on each 
    //           update calls the list of listener functions
    run(start, n_data) {
        if (!(this.running == true)) {
            return;
        }
        var self = this;
        var alertID = this.name().replace(/\s/g, '').replace(/:/g,'').replace(/_/g,'');
        var alertText = "Loading data for request (" + this.name() + ")";
        var timeout = setTimeout(function() { throw_alert(alertText, alertID);}, 3000);
        this.data.get_data_promise(start, undefined, n_data)
            .then(function(value) {
               clearTimeout(timeout);
                for (var i = 0; i < self.listeners.length; i++) {
                    var func = self.listeners[i];
                    func(value, true);
                }

                // run again 
                // determine the start
                var next_start = start;
                if (next_start !== undefined && value.min_end_time != 0 && value.min_end_time != undefined) next_start = value.min_end_time;
                setTimeout(function() { self.run(next_start, n_data); }, self.timeout);
            })
            .catch(function(error) {
              throw_database_error(error, "poll_run");
            })
            .finally(function() { clearTimeout(timeout); remove_alert(alertID); });
    }

    isRunning() {
      return this.running;
    }

    // behavior: stops the D3DataPoll from running
    // NOTE: you should always call this function when deleting an old Poll.
    // Otherwise, it will run forever
    stop() {
        this.running = false;
    }

    // returns the name of the D3DataChain/Link provided as input
    name() {
        return this.data.name();
    }
}

export class D3DataChain {
  // input:
  // data_link: a list of D3DataLink objects
  // name: (optional) provide some name to be returned by the name() getter/setter
  constructor(data_links, name) {
    this.data_links = data_links;
    this.local_name = name;
  }

  add(link) {
    return new D3DataChain(this.data_links.concat(link.data_links), this.local_name);
  }

  // expose the list of each data_link's accessors()
  accessors() {
    var ret = [];
    for (var i = 0; i < this.data_links.length; i ++) {
      ret = ret.concat(this.data_links[i].accessors());
    }
    return ret;
  }

  // and the step(s)
  get_step(callback) {
    Promise.all(this.data_links.map(function(data_link) {
      return data_link.get_step_promise();
    }))
      .then(function(data) {
        var steps = [];
        for (var i = 0; i < data.length; i ++) {
          steps.push(data[i].step)
        }
        var inp = {};
        inp.step = Math.min(...steps)
        callback(inp);
      });
  }

  get_step_promise() {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.get_step(resolve);
    });
  }

  // For everything below: Same interface as D3DataLink
  // However, the data returned (either through a promise or in a callback)
  // will be formatted as a list of the data returned by each provided D3DataLink
  get_data(d3_callback, start, stop, n_data) {
    var self = this;
    return Promise.all(this.data_links.map(function(iter_data_link) {
         return iter_data_link.get_data_promise(start, stop, n_data);
      }))
      .then(function(values) {
        var flatten = {};
        for (var i = 0; i < self.data_links.length; i++) {
          var accessors = self.data_links[i].accessors();
          for (var j = 0; j < accessors.length; j++) {
            flatten[accessors[j]] = values[i].values[accessors[j]];
          }
        }
        var inp = {};
        inp.values = flatten;
        d3_callback(inp);
      });
  }

  get_data_promise(start, stop, n_data) {
      var self = this;
      return new Promise(function(resolve, reject) {
        self.get_data(resolve, start, stop, n_data)
            .catch(reject);
      });
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

export class D3DataLink {
  // input:
  // link_builder: a class which must implement the interface defined in DataLink.js
  // name: (optional) provide some name to be returned by the name() getter/setter
  constructor(link_builder, name) {
    this.link_builder = link_builder;
    this.local_name = name;
    this.data_links = [this];
  }

  add(link) {
    return new D3DataChain(this.data_links.concat(link.data_links), this.local_name);
  }

  // expose the link_builder accessors() function
  accessors() {
    return this.link_builder.accessors();
  }

  // function to get step w/ callback
  get_step(callback) {
    d3.json(this.link_builder.step_link(), function(err, data) {
      if (!data) {
        data = {"step": 0};
        throw_database_error(err, "get_step");        
      }
      callback(data);
    });
  }

  // or get step as a promise
  get_step_promise() {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.get_step(resolve);
    });
  }

  // input:
  // d3_callback: callback function to be called with the data provided by the flask backend
  // start: start index into the stream
  // stop: (optional) stop index into the stream -- set to current time by default
  get_data(d3_callback, start, stop, n_data) {
     var self = this;
     return d3.json(self.link_builder.data_link(start, stop, n_data), d3_callback);
  }

  // input:
  // start: start index into the stream
  // stop: (optional) stop index into the stream -- set to current time by default
  //
  // returns: a javascript Promise which will return the data when it is ready
  get_data_promise(start, stop, n_data) {
    var self = this;
    return new Promise(function(resolve, reject) {
      d3.json(self.link_builder.data_link(start, stop, n_data), function(err, data) {
        if (!data) {
          return reject(err);
        }
        resolve(data);
     });
     });
  }

  // "local_name" getter/setter
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
}

