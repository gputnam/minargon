class TimeSeries {
  constructor(config, stream_links, streams, href) {
    this.config = config;
    this.stream_links = stream_links;
    this.href = href;
    this.streams = streams;

    this.server_delay = 5000; // guess, for now
  }

  data_link(stream_index, metric_list, field_list) {
    if (metric_list === undefined) {
      metric_list = this.config.metric_list;
    }
    if (field_list === undefined) {
      var fields = this.config.fields;
    }
    else {
      var fields = [];
      for (var i = 0; i < field_list.length; i++) {
        fields.push( this.config.fields[field_list[i]] );
      }
    }
    return new MetricStreamLink($SCRIPT_ROOT + this.stream_links[stream_index], this.streams[stream_index], 
        this.config.instance, fields, metric_list, false);
  }

  infer_step(stream_index, callback) {
    if (this.stream_links.length == 0) return callback(0);
 
    var link = new MetricStreamLink($SCRIPT_ROOT + this.stream_links[stream_index], this.streams[stream_index],
        this.config.instance, this.config.fields, this.config.metric_list, false);

    return d3.json(link.step_link(), function(data) { callback(data.step); });
  }

  // collect default parameters from metric
  default_param(metric) {
    return this.config.metric_config[metric];
  }

  getLink(index) {
    if (!(this.href === undefined)) {
        return this.href(this.config.instance, this.config.fields[index]);
    }
    return undefined;
  }

}

class CubismSingleStreamController {
  constructor(target, stream_name, height) {
    this.stream_name = stream_name;
    this.target = target;
    this.height = height;
    this.max_data = 1000;

    this.range = [];
  }

  buildContext(callback) {
    var self = this;
    d3.json("/online/infer1_step_size/" + this.stream_name, function(data) {
      create_cubism_context_with_step(self.target, data.step, function(step, context) {
        self.step = step;
        self.context = context;
        callback(self);
      });
    });
  }

  heightController(id) {
    var self = this;
    $(id).change(function() { self.updateParam(this.value, "height"); });
    return this;
  }
  rangeController(id_lo, id_hi, update_on_metric_change) {
    var self = this;

    $(id_lo).keypress(function(e) {
      if (e.which == 13) {
        self.updateParam(this.value, "range-lo");
      }
    });
    $(id_hi).keypress(function(e) {
      if (e.which == 13) {
        self.updateParam(this.value, "range-hi");
      }
    });

    if (!(update_on_metric_change === false)) {
        this.range_lo_controller = id_lo;
        this.range_hi_controller = id_hi;
    }
    return this;
  }

  updateParam(input, param_name) {
    // update this param
    if (param_name == "height") this.height = input;
    else if (param_name == "range-hi") this.range[1] = input;
    else if (param_name == "range-lo") this.range[0] = input;
    // if no valid update, just return
    else return;

    // redraw horizons
    var data = d3.select(this.target).selectAll('.horizon').data();
    delete_horizons(this);
    make_horizons(this, data);
  }

  updateData() {
    // make a new buffer
    // to be on the safe side, get back to ~1000 data points
    var start = new Date(); 
    start.setSeconds(start.getSeconds() - this.step * this.max_data / 1000); // ms -> s
    this.cubism_on = false;

    // get the link
    var link = new SingleStreamLink($SCRIPT_ROOT + "/online", this.stream_name);
    //var data = new D3DataLink(link);
    // get the poll
    //var poll = new D3DataPoll(data, this.step, []);

    // get the data source
    var source = new D3DataSource(link, -1);

    // wrap with a buffer
    this.buffer = new D3DataBuffer(source, [[this.stream_name]], this.max_data, [this.startCubism.bind(this)]);
    this.cubism_on = false;
    this.buffer.run(start);

    // start up the data source
    this.data_source = new D3DataSource(new SingleStreamLink($SCRIPT_ROOT + "/online", this.stream_name), -1, []);
    this.data_source.run(start);
  }

  dataLink(buffers) {
    return build_data_link(0, buffers[0]);
  }

  startCubism(buffers) {
    if (!this.cubism_on) {
      var metrics = [this.context.metric(this.dataLink(buffers), this.stream_name)];
      make_horizons(this, metrics);
      this.cubism_on = true;
    }
  }

  run() {
    this.buildContext(function(self) {
      self.updateData();
    });
  }

}

class CubismMultiMetricController {
  constructor(target, timeseries_config, field_index, stream_links, streams, stream_index, height) {
    this.timeseries = new TimeSeries(timeseries_config, stream_links, streams);
    this.target = target;
    this.height = height;
    this.field_index = field_index;
    this.stream_index = stream_index;

    this.max_data = 1000;
  }

  buildContext(callback) {
    var self = this;
    create_cubism_context(this.target, this.timeseries, function(step, context) {
      self.step = step;
      self.context = context;
      callback(self);
    });
  }

  heightController(id) {
    var self = this;
    $(id).change(function() { self.updateHeight(this.value); });
    return this;
  }

  streamController(id) {
    var self = this;
    $(id).change(function() {self.updateStream(this.value);});
    return this;
  }
  metrics(metric_list) {
    this.metric_list = metric_list;
    return this;
  }
 
  updateStream(input) {
    this.stream_index = input;
    var self = this;
    this.timeseries.infer_step(input, function(step) {
      self.step = step;
      self.context.step(step);
      // remake the data
      self.updateData(true);
    });
  }

  updateHeight(input) {
    this.height = input;

    // redraw horizons
    var data = d3.select(this.target).selectAll('.horizon').data();
    delete_horizons(this);
    make_horizons(this, data);

  }
 
  updateData(remove_old) {
    // if no streams, don't do anything
    if (this.timeseries.streams.length == 0) {
      return;
    }

    if (remove_old === true)
      delete_horizons(this);

    if (!(this.buffer === undefined)) {
      this.buffer.stop();
    }

    var pairs = [];
    for (var i = 0; i < this.timeseries.config.metric_list.length; i++) {
      pairs.push( [this.timeseries.config.metric_list[i], this.timeseries.config.fields[this.field_index].link] );
    }

    // make a new buffer
    var start = new Date();
    start.setSeconds(start.getSeconds() - this.step * this.max_data / 1000); // ms -> s
    this.cubism_on = false;

    // get the link
    var poll = new D3DataPoll(new D3DataLink(this.timeseries.data_link(this.stream_index, undefined, [this.field_index])),
      this.step);
    // and the buffer
    this.buffer = new D3DataBuffer(poll, pairs, this.max_data, [this.startCubism.bind(this)]);
    this.buffer.run(start);
  }

  dataLinks(buffers) {
    var ret = [];
    for (var j = 0; j < this.timeseries.config.fields.length; j++) {
      ret.push( build_data_link(j, buffers[j]) );
    }
    return ret;
  }

  startCubism(buffers) {
    if (!this.cubism_on) {
      this.cubism_metrics = add_metrics(this, this.dataLinks(buffers), true);
      this.cubism_on = true;
    }
  }

  run() {
    this.buildContext(function(self) {
      self.updateData();
    });
  }

}

// class for controlling parameters of cubism context
class CubismController {
  constructor(target, timeseries_config, metric, stream_links, streams, stream_index, height) {
    this.timeseries = new TimeSeries(timeseries_config, stream_links, streams);

    this.height = height;
    this.metric = metric;
    this.target = target;
    this.stream_index = stream_index;

    this.range = [];

    // max data
    this.max_data = 1000;
  }

  buildContext(callback) {
    var self = this;
    create_cubism_context(this.target, this.timeseries, function(step, context) {
      self.step = step;
      self.context = context;
      callback(self);
    });
  }

  set() {
    this.metricParam();
    return this;
  }

  linkFunction(Fhref) {
    this.timeseries.href = Fhref;
    return this;
  }
 
  metricController(id) {
    var self = this;
    $(id).change(function() { self.updateMetric(this.value); });
    return this;
  }
  heightController(id) {
    var self = this;
    $(id).change(function() { self.updateParam(this.value, "height"); });
    return this;
  }
  rangeController(id_lo, id_hi, update_on_metric_change) {
    var self = this;

    $(id_lo).keypress(function(e) {
      if (e.which == 13) {
        self.updateParam(this.value, "range-lo");
      }
    });
    $(id_hi).keypress(function(e) {
      if (e.which == 13) {
        self.updateParam(this.value, "range-hi");
      }
    });

    if (!(update_on_metric_change === false)) {
        this.range_lo_controller = id_lo;
        this.range_hi_controller = id_hi;
    }
    return this;
  }

  streamController(id) {
    var self = this;
    $(id).change(function() {self.updateStream(this.value);});
    return this;
  }

  onClick(stream_name, index) {
    // check if link function is defined
    var link = this.timeseries.getLink(index);
    if (!(link === undefined)) {
        // go there
        window.location.href = $SCRIPT_ROOT + "/" + link;
    }
  }

  metricParam() {
    var metric_param = this.timeseries.default_param(this.metric);
    if (metric_param === undefined) {
      metric_param = {};
    }
    if (!(metric_param.range === undefined)) {
      this.range = metric_param.range; 
    }
    else {
      this.range = [];
    }

    this.format = metric_param.format;
    // set in range values
    if (!(this.range_lo_controller === undefined)) {
      if (this.range.length != 0) {
        $(this.range_lo_controller).val(this.range[0]);
      }
      else { 
       $(this.range_lo_controller).val("");
     }
    } 
    if (!(this.range_hi_controller === undefined)) {
      if (this.range.length != 0) {
        $(this.range_hi_controller).val(this.range[1]);
      }
      else {
        $(this.range_hi_controller).val("");
      }
    }
  }

  updateMetric(metric) {
    this.metric = metric;
    this.metricParam();
    this.updateData(true);
  } 

  updateStream(input) {
    this.stream_index = input;
    var self = this;
    this.timeseries.infer_step(input, function(step) {
      self.step = step;
      self.context.step(step);
      // remake the data
      self.updateData(true);
    });
  }

  updateParam(input, param_name) {
    // update this param
    if (param_name == "height") this.height = input;
    else if (param_name == "range-hi") this.range[1] = input;
    else if (param_name == "range-lo") this.range[0] = input;
    // if no valid update, just return
    else return;

    // redraw horizons
    var data = d3.select(this.target).selectAll('.horizon').data();
    delete_horizons(this);
    make_horizons(this, data);
  }

  updateData(remove_old) {
    // if no streams, don't do anything
    if (this.timeseries.streams.length == 0) {
      return;
    }

    if (remove_old === true) {
        delete_horizons(this);
    }

    // reset the poll
    if (!(this.buffer === undefined)) {
      this.buffer.stop();
    }

    // build the metric/field pais we expect to access
    var pairs = [];
    for (var i = 0; i < this.timeseries.config.fields.length; i++) {
      pairs.push([this.metric, this.timeseries.config.fields[i].link]);
    }

    // make a new buffer
    // to be on the safe side, get back to ~1000 data points
    var start = new Date(); 
    start.setSeconds(start.getSeconds() - this.step * this.max_data / 1000); // ms -> s
    this.cubism_on = false;

    var link = this.timeseries.data_link(this.stream_index, [this.metric]);

    // first build the poll
    var poll = new D3DataPoll(new D3DataLink(link), this.step, []);

    // get the data source
    //var source = new D3DataSource(link, -1);

    // wrap with a buffer
    this.buffer = new D3DataBuffer(poll, pairs, this.max_data, [this.startCubism.bind(this)]);
    this.buffer.run(start);
  }

  dataLinks(buffers) {
    var ret = [];
    for (var j = 0; j < this.timeseries.config.fields.length; j++) {
      ret.push( build_data_link(j, buffers[j]) );
    }
    return ret;
  }

  startCubism(buffers) {
    if (!this.cubism_on) {
      this.cubism_metrics = add_metrics(this, this.dataLinks(buffers), true);
      this.cubism_on = true;
    }
  }

  run() {
    this.buildContext(function(self) {
      self.updateData();
    });
  }

}

// add in metrics w/ a horizon chart to the provided target
function add_metrics(controller, data_links, use_field_name) {
  // add new metrics
  var data = data_links.map(function(data_link, i) { 
    // use the field name or the metric name
    if (use_field_name) {
      var metric = controller.context.metric(data_link.bind(data_link), controller.timeseries.config.fields[i].name);
    }
    else {
      var metric = controller.context.metric(data_link.bind(data_link), controller.timeseries.config.metric_list[i]);
    }
    //metric.on("change", function(start, stop) {});
    return metric;
  });
    return make_horizons(controller, data);
}

// make new horizon objects
function make_horizons(controller, data) {
  var horizon = controller.context.horizon();
  horizon = horizon.height(controller.height);
  if (controller.range !== undefined && controller.range.length != 0) { 
    horizon = horizon.extent(controller.range);
  }
  if (!(controller.format === undefined)) {
    horizon = horizon.format(controller.format);
  }
  var horizons = d3.select(controller.target).selectAll('.horizon')
      .data(data)
      .enter().insert("div", ".bottom")
      .attr("class", "horizon")
      .call(horizon);
  if (!(controller.onClick == undefined)) {
    horizons.on("click", controller.onClick.bind(controller));
  }
  return horizons;
}

// delete the horizons and the associated metrics
function delete_horizons(controller) {
  d3.select(controller.target).selectAll('.horizon')
      .call(controller.context.horizon().remove)
      .remove();
}

function create_cubism_context_with_step(target, step, callback) {
  // if we couldn't figure out what the step size should be, default to 1s
  // any step less than 1s is a mistake
  if (step < 1000) step = 1000; // units of ms
  var size = $(target).width();
  var context = cubism.context()
    //.serverDelay(timeseries.server_delay)
    .serverDelay(5000)
    .step(step)
    .size(size); 

  // delete old axes
  $(target + ' .axis').remove();
  
  // add time axes
  d3.select(target).selectAll(".axis")
    .data(["top", "bottom"])
    .enter().append("div")
    .attr("class", function(d) { return d + " axis"; })
    .each(function(d) {
     var axis = context.axis()
	.ticks(12)
	.orient(d);
	//.focusFormat(focus_format);
	d3.select(this).call(axis);
      });

  // delete old rule
  $(target + ' .rule').remove();
  
  d3.select(target).append("div")
  .attr("class", "rule")
  .call(context.rule());    
  
  callback(step, context);
}

function create_cubism_context(target, timeseries, callback) {
    // get what the step size should be 
    timeseries.infer_step(0, function(step) {
      create_cubism_context_with_step(target, step, callback);
    });
}

function build_data_link(ind, buffer) {
  return function(start, stop, step, callback) {
    // setup timestamps
    var tz_start = moment.tz(start, "US/Central");
    var tz_stop = moment.tz(stop, "US/Central");  
    var ts_start = tz_start.unix() * 1000;
    var ts_stop = tz_stop.unix() * 1000;
    var n_data = (ts_stop - ts_start) / step;
    
    // now get the data
    var ret = [];
    // special cases -- no data available
    if (buffer.size == 0 || 
      buffer.get_first()[0] > ts_stop ||
      buffer.get_last()[0] < ts_start) {
      for (var i = 0; i < n_data; i++) {
        ret.push(0);
      }
      return callback(null, ret);
    }
    
    // get data
    var last_index = 0;
    for (var i = 0; i < n_data; i ++) {
      var time = ts_start + i * step;
      while (true) {
        if (last_index == buffer.size) {
	  ret.push(0);
	  break;
        }
        var index = buffer.get(last_index)[0];
        // if the index is too small, continue
        if (index <= time) {
          last_index += 1;
          continue;
        }
        // if we're too small to have good data, just push zero
        if (last_index == 0) {
          ret.push(0);
          break;
        }
        // if there was a gap, continue
        if (time + step < index) {
            ret.push(0);
            break;
        }
        // otherwise, we can interpolate!
        ret.push(buffer.get(last_index)[1]);
        break;
      }
    }
    return callback(null, ret);
  };
}

