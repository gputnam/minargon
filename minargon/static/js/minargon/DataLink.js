// pass to D3DataLink to get stuff
class ChannelLink {
  constructor(script_root, data_name, channel_no) {
    this.data_name = data_name;
    this.channel_no = channel_no;
    this.root = script_root;
  }

  data_link(start, stop, stream) {
    var args = $.param(timeArgs(start, stop, stream));
    return this.root + '/wire_stream/' + this.data_name + '/' + this.channel_no +'?' + args;
  }
  name() {
    return this.data_name;
  }
}

function wire_link(metric, instance, field) {
  return new D3DataLink(new ChannelLink($SCRIPT_ROOT, metric, field.wire));
}

function multi_wire_link(metric, instance, fields) {
  var wires = [];
  for (var i = 0; i < fields.length; i++) {
    wires.push(Number(fields[i].name.split(" ")[1]));
  }
  var wire_max = Math.max(...wires)+1;
  var wire_min = Math.min(...wires); 
  return new D3DataLink(new MultiWireLink($SCRIPT_ROOT, metric, wire_min, wire_max));
}

function flatten(arr) {
    return arr[0];
}

function multi_link(Flink, metric, instance, fields) {
  var data_links = [];
  for (var i = 0; i < fields.length; i++) {
    data_links.push(Flink(metric, instance, fields[i]));
  }
  return new D3DataChain(data_links, metric, flatten);
}

function readout_link(metric, instance, field) {
  return new D3DataLink(new CrateLink($SCRIPT_ROOT, metric, field.crate));
}
function multi_readout_link(metric, instance, fields) {
  return mult_link(readout_link, metric, instance, fields);
}

function crate_link(metric, instance, field) {
  return new D3DataLink(new FEMLink($SCRIPT_ROOT, metric, instance.crate, field.fem));
}
function multi_crate_link(metric, instance, fields) {
  return multi_link(crate_link, metric, instance, fields);
}

function fem_link(metric, instance, field) {
  var channel = field.wire;
  return new D3DataLink(new ChannelLink($SCRIPT_ROOT, metric, channel));
}
function multi_fem_link(metric, instance, fields) {
  return multi_link(fem_link, metric, instance, fields);
}

function TPC_metric(metric, instance, fields) {
  return new D3DataLink(new EventInfoLink($SCRIPT_ROOT, metric));
}

// pass to D3DataLink to get stuff
class FEMLink {
    constructor(script_root, data_name, crate, fem) {
        this.data_name = data_name;
        this.crate = crate;
        this.fem = fem;
        this.root = script_root;
    }

    data_link(start, stop, stream) {
        var args = $.param(timeArgs(start, stop, stream));
        return this.root + '/stream/' + this.data_name + '/' + this.crate + '/' + this.fem + '?' + args;
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

    data_link(start, stop, stream) {
        var args = $.param(timeArgs(start, stop, stream));
        return this.root + '/stream/' + this.data_name + '/' + this.crate + '?' + args;
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
    data_link(start, stop, stream) {
        var args = $.param(timeArgs(start, stop, stream));
        return this.root + '/wire_query/' + this.data_name + '/' + this.wire_start + '/' + this.wire_end + '?' + args;
    }
 
    name() {
        return this.data_name;
    }
}

// Link to data on Event Info 
class EventInfoLink {
    constructor(script_root, data_name) {
	this.root = script_root;
        this.data_name = data_name;
    }

    data_link(start, stop, stream) {
        var args = $.param(timeArgs(start, stop, stream));
	return this.root + '/stream_eventinfo/' + this.data_name + '/'  + '?' + args;
    }

    name() {
	return this.data_name;
    }
}

function timeArgs(start, stop, stream_name) {
  var ret = {
   now: new Date().toISOString(),
   stream_name: stream_name,
  };
  // start can be null
  if (start != null) {
    if (!isNaN(stream_name)) {
      ret.start = start.toISOString();
    }
    else {
      ret.start = start;
    }
  }

  if (stop != null && !isNaN(stream_name)) {
    if (!isNaN(stream_name)) {
      ret.stop = stop.toISOString();
    }
    else {
      ret.stop = stop;
    }
  }
  // set step if using a time stream
  if (!isNaN(stream_name)) {
    ret.step = stream_name;
    ret.stream_name = stream_name / 1000;
  }
  return ret;

}



