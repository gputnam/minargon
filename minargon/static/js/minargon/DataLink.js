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

  name() {
    return this.stream;
  }
}

// DataLink which connects configured timeseries with the backend API for online metrics

// Arguments to constructor:
// root: the root path where all of the API endpoints are defined
// stream: the name of the stream
// instance: the instance object provided by the configuration backend
// fields: a list of field objects provided by the configuration backend 
// metrics: a list of metrics
// sequence: you should set this to false unless you know what you are doing
export class MetricStreamLink {
  constructor(root, stream, instance, fields, metrics, sequence) {
    this.root = root;
    this.stream = stream;
    this.instance = instance;
    this.metrics = metrics;
    if (sequence === true) {
      this.sequence = true;
      this.field_start = String(fields[0]);
      this.field_end = String(fields[1]);
    }
    else {
      this.sequence = false;
      this.fields = fields;
    }
  }
 
  step_link() {
    var link = this.root + '/infer_step_size/' + this.stream + '/' + this.metrics[0] + '/' + this.instance.link + '/' + this.fields[0].link;
    return link;
  }
  
  data_link_internal(base, start, stop) {
    if (this.sequence) {
      var fields = '/' + this.field_start + '/' + thif.field_end; 
    }
    else {
      var fields = "";
      for (var i = 0; i < this.fields.length; i++) {
        fields = fields + this.fields[i].link + ',';
      }
    }
    var metrics = "";
    for (var i = 0; i < this.metrics.length; i++) {
      metrics = metrics + this.metrics[i] + ',';
    }

    var ret = this.root + base + this.stream + '/' + metrics + '/' + this.instance.link + '/' + fields;
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

  name() {
    if (this.metrics.length == 1) return this.metrics[0];
    if (!this.sequence && this.fields.length == 1)  return this.fields[0].name;
    return this.instance.name;
  }

}

function flatten(arr) {
    return arr[0];
}

// start/stop can be a date or an integer
function timeArgs(start, stop) {
  // if start is undefined, just return null
  if (start === undefined) return null;
  var ret = {
    now: new Date().toISOString(),
  };
  if (start instanceof Date) {
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



