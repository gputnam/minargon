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
  constructor(link_builder, operation, name) {
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
	function(data) {
	    if (!data) return d3_callback(new Error('unable to load data'));
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

  name() {
    if (this.local_name === null || this.local_name === undefined) {
      return this.link_builder.name();
    }
    else {
      return this.local_name;
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

class ChannelLink {
  constructor(script_root, data_name, channel_no) {
    this.data_name = data_name;
    this.channel_no = channel_no;
    this.root = script_root;
  }

  data_link(start, stop, step) {
    return this.root + '/channel_data' + 
	'?expr=' + this.data_name +
        '&channel=' + this.channel_no.toString() + 
	'&start=' + start.toISOString() +
	'&stop=' + stop.toISOString() +
	'&now=' + new Date().toISOString() +
	'&step=' + step;
  }
  name() {
    return this.data_name + ": "  + this.channel_no.toString();
  }
}

