import {CircularBuffer} from "./circular_buffer.js";

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
    for (var i = 0; i < this.accessors.length; i++) {
      this.buffers.push( new CircularBuffer(n_data) );
    }
    this.poll.listeners = [this.updateBuffers.bind(this)];
    this.listeners = listeners;
  }

  // run: start the Poll/Source and connect with the buffers
  run(start) {
    this.poll.run(start);
  }

  // stop: stop the Poll/Source
  stop() {
    this.poll.stop();
  }


  // internal function which updates the managed circular buffers with new data
  updateBuffers(value) {
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
        this.buffers[i].push(this_data[j]);
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
  }

  // expose the link's accessors
  accessors() {
    return this.link.accessors();
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

  // behavior: stops the D3DataSource from running
  // NOTE: you should always call this function when deleting an old Source.
  // Otherwise, it will run forever
  stop() {
    this.source.close();
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
        this.running = true;
    }

    // expose the data object accessors
    accessors() {
      return this.data.accessors();
    }

    // input:
    // start: the start index into each time series for the first call to the D3DataLink/Chain
    // behavior: starts up the D3DataPoll -- repetitively polls the backend for data and on each 
    //           update calls the list of listener functions
    run(start) {
        if (!(this.running == true)) {
            return;
        }
        var self = this;
        this.data.get_data_promise(start)
            .then(function(value) {
                for (var i = 0; i < self.listeners.length; i++) {
                    var func = self.listeners[i];
                    func(value);
                }
                // run again 
                // determine the start
                var next_start = start;
                if (value.min_end_time != 0) next_start = value.min_end_time;
                setTimeout(function() { self.run(next_start); }, self.timeout);
            });
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

  // expose the list of each data_link's accessors()
  accessors() {
    var ret = [];
    for (var i = 0; i < this.data_links.length; i ++) {
      ret = ret + this.data_links.accessors();
    }
    return ret;
  }

  // For everything below: Same interface as D3DataLink
  // However, the data returned (either through a promise or in a callback)
  // will be formatted as a list of the data returned by each provided D3DataChain

  get_data(d3_callback, start, stop) {
    return Promise.all(this.data_links.map(function(iter_data_link) {
       return iter_data_link.get_data_promise(start, stop);
    }))
      .then(values => d3_callback(null, values));
//            error => d3_callback(new Error("unable to load data")));
  }

  get_data_promise(start, stop) {
      return Promise.all(this.data_links.map(function(iter_data_link) {
         return iter_data_link.get_data_promise(start, stop);
       }))
          .then(values => Promise.resolve(values));
               // error => reject(error));
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
  }

  // expose the link_builder accessors() function
  accessors() {
    return this.link_builder.accessors();
  }

  // input:
  // d3_callback: callback function to be called with the data provided by the flask backend
  // start: start index into the stream
  // stop: (optional) stop index into the stream -- set to current time by default
  get_data(d3_callback, start, stop) {
     var self = this;
     return d3.json(self.link_builder.data_link(start, stop),
	function(err, data) {
	    if (!data) {
                return d3_callback(new Error('unable to load data'));
            }
	    return d3_callback(data);
	});
  }

  // input:
  // start: start index into the stream
  // stop: (optional) stop index into the stream -- set to current time by default
  //
  // returns: a javascript Promise which will return the data when it is ready
  get_data_promise(start, stop) {
    var self = this;
    return new Promise(function(resolve, reject) {
      d3.json(self.link_builder.data_link(start, stop), function(data) {
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

