class D3DataChain {
  // expects a list of DataLinks and a final operation which 
  // composes the links into a final result
  constructor(data_links, operation) {
    this.operation = operation;
    this.data_links = data_links;
    this.name = null;
  }

  constructor(data_links, operation, name) {
    this.operation = operation;
    this.data_links = data_links;
    this.name = name;
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
 
  name() {
    if (this.name == null) {
      return this.data_links[0].name();
    }
    else {
      return this.name;
    }
  }
}

class D3DataLink {
  // takes as input a class which must implement the interface defined
  // by ChannelLink below.
  constructor(link_builder) {
    this.link_builder = link_builder;
    this.operation = function(x) { return x; };
  }
  
  construcor(link_builder, operation) {
    this.link_builder = link_builder;
    this.operation = operation;
  }

  get_data(start, stop, step, d3_callback) {
     return d3.json(this.link_builder.data_link(start, stop, step),
	function(data) {
	    if (!data) return d3_callback(new Error('unable to load data'));
	    return d3_callback(null,this.operation(data.values));
	});
  }
  
  get_data_promise(start, stop, step) {
    // Magic Javascript garbage
    var self = this;
    return new Promise(function(resolve, reject) {
      d3.json(self.link_builder.data_link(start, stop, step), function(data) {
        resolve(this.operation(data.values));
     });
     });
  }
  name() {
    return this.link_builder.name();
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

