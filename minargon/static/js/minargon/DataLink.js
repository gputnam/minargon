// all the datalinks...

// DataLink which connects a epics stream given the ID

// Arguments to constructor:
// root: the root path wehre all of the API endpoints are defined
// ID: the epics channel ID
export class EpicsStreamLink {
  constructor(root, database, ID) {
    this.root = root;
    this.database = database;
    this.ID = String(ID);
  }

  step_link() {
    return this.root + "/" + this.database + "/ps_step/" + this.ID;
  }

  data_link(start, stop) {
    return this.root + "/" + this.database + "/ps_series/" + this.ID + '?' + $.param(timeArgs(start, stop));
  }

  config_link() {
    return this.root + "/" + this.database + "/pv_meta/" + this.ID;
  }

  accessors() {
    return [[this.ID]];
  }

  name() {
    return this.ID;
  }

}


// DataLink which connects a raw stream name with the backend API for online metrics

// Arguments to constructor:
// root: the root path where all of the API endpoints are defined
// stream: the full name of the stream 
export class SingleStreamLink {
  constructor(root, stream) {
    this.stream = stream;
    this.root = root;
  }

  step_link() {
    return this.root + '/infer_step_size/' + this.stream;
  }
 
  data_link(start, stop) {
    return this.root + '/stream/' + this.stream + '?' + $.param(timeArgs(start, stop));
  }

  event_source_link(start) {
    return this.root + '/stream_subscribe/' + this.stream + '?' + $.param(timeArgs(start, null));
  }

  accessors() {
    return [[this.stream]];
  }

  name() {
    return this.stream;
  }
}

// DataLink which connects configured timeseries with the backend API for online metrics

// Arguments to constructor:
// root: the root path where all of the API endpoints are defined
// stream: the name of the stream
// group: the group object provided by the configuration backend
// instances: a list of instances provided by the configuration backend 
// metrics: a list of metrics
// sequence: you should set this to false unless you know what you are doing
export class MetricStreamLink {
  constructor(root, stream, group, instances, metrics, sequence) {
    this.root = root;
    this.stream = stream;
    this.group = group;
    this.metrics = metrics;
    if (sequence === true) {
      this.sequence = true;
      this.field_start = String(instances[0]);
      this.field_end = String(instances[1]);
    }
    else {
      this.sequence = false;
      this.instances = instances;
    }
  }
 
  step_link() {
    var metric_list = "";
    for (var i = 0; i < this.metrics.length; i++) {
      metric_list = metric_list + this.metrics[i] + ",";
    }
    var link = this.root + '/infer_step_size/' + this.stream + '/' + metric_list + '/' + this.group + '/' + this.instances[0];
    return link;
  }
  
  data_link_internal(base, start, stop) {
    if (this.sequence) {
      var instances = this.field_start + '/' + this.field_end; 
    }
    else if (this.instances.length == 1) {
      var instances = this.instances[0] + ","; 
    }
    else {
      var instances = "";

      // check if sequential
      var is_sequential = true;
      for (var i = 1; i < this.instances.length; i++) {
        if (Number(this.instances[i]) - 1 != Number(this.instances[i-1])) {
          is_sequential = false;
          break;
        }
      }

      if (!is_sequential) {
        for (var i = 0; i < this.instances.length; i++) {
          instances = instances + this.instances[i] + ',';
        }
      }
      else {
        instances = this.instances[0] + "/" + (Number(this.instances[this.instances.length-1])+1);
      }
    }
    var metrics = "";
    for (var i = 0; i < this.metrics.length; i++) {
      metrics = metrics + this.metrics[i] + ',';
    }

    var ret = this.root + base + this.stream + '/' + metrics + '/' + this.group + '/' + instances;
    var args = timeArgs(start, stop);
    if (!(args === null)) {
      ret = ret + '?' + $.param(args);
    }
    return ret;
  }

  data_link(start, stop) {
    return this.data_link_internal('/stream_group/', start, stop);
  }

  event_source_link(start) {
    return this.data_link_internal('/stream_group_subscribe/', start, null);
  }

  accessors() {
    var ret = [];
    // iterate first over each metric
    for (var i = 0; i < this.metrics.length; i++) {
      // iterate over the instances
    
      // sequence
      if (this.sequence) {
        for (var field = this.field_start; field < this.field_start + this.field_end; field++) {
          ret.push( [this.metrics[i], String(field)] );
        }
      }
      // not a sequence -- iterate over the provided instances
      for (var j = 0; j < this.instances.length; j++) {
        ret.push( [this.metrics[i], this.instances[j]] );
      }
    }
    return ret;

  }

  name() {
    if (this.metrics.length == 1) return this.metrics[0];
    if (!this.sequence && this.instances.length == 1)  return this.instances[0].name;
    return this.group.name;
  }

}

function flatten(arr) {
    return arr[0];
}

// start/stop can be a date or an integer
function timeArgs(start, stop) {
  // if start is undefined, just return null
  if (start === undefined) return {};
  var ret = {
    now: new Date().toISOString(),
  };
  if (start instanceof Date) {
    // alert(start);
    ret.start = start.toISOString();
  }
  else {
    ret.start = start;
  }
  // stop doesn't have to be set
  if (!(stop === undefined)) {
    if (stop instanceof Date) {
      ret.stop = stop.toISOString();
    }
    else {
       ret.stop = stop;
    }
  }
  return ret;

}



