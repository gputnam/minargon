class D3DataBuffer {
  constructor(poll, accessors, n_data, listeners) {
    this.poll = poll;
    this.accessors = accessors;
    this.buffers = [];
    for (var i = 0; i < this.accessors.length; i++) {
      this.buffers.push( new CircularBuffer(n_data) );
    }
    this.poll.listeners = [this.updateBuffers.bind(this)];
    this.listeners = listeners;
  }

  run(start) {
    this.poll.run(start);
  }

  stop() {
    this.poll.stop();
  }


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

class D3DataSource {
  constructor(link, timeout, listeners) {
    this.link = link;
    this.timeout = timeout;
    this.listeners = listeners;
  }

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

  stop() {
    this.source.close();
  }

}

class D3DataPoll {
    // expects a D3DataLink or D3DataChain
    constructor(data, timeout, listeners) {
        this.data = data;
        this.timeout = timeout;
        this.listeners = listeners;
        this.running = true;
    }

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
  constructor(data_links, name) {
    this.data_links = data_links;
    this.local_name = name;
  }

  // Same interface as D3DataLink
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

class D3DataLink {
  // takes as input a class which must implement the interface defined by LinkBuilder
  constructor(link_builder, name) {
    this.link_builder = link_builder;
    this.local_name = name;
  }

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

  get_data_promise(start, stop) {
    // Magic Javascript garbage
    var self = this;
    return new Promise(function(resolve, reject) {
      d3.json(self.link_builder.data_link(start, stop), function(data) {
        resolve(data);
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
}

