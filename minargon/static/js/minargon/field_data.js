class FieldData {
  constructor(title, config, metric, stream, stream_link) {
    this.name = name;
    this.config = config;
    this.title = title;
    this.buffer = null;
    this.metric = metric;
    this.stream = stream;
    this.stream_link = stream_link;
    this.metricParam();
    this.listeners = [];
    this.histograms = [];
    this.scatters = [];
  
    this.range = [];
    this.warning_range = [];
  }

  set() {
    this.metricParam();
    return this;
  }

  metricController(id) {
    var self = this;
    $(id).change(function() { self.updateMetric(this.value); });
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
  warningrangeController(id_lo, id_hi, update_on_metric_change) {
    var self = this;
    $(id_lo).keypress(function(e) {
      if (e.which == 13) {
        self.updateParam(this.value, "warning-range-lo");
      }
    });
    $(id_hi).keypress(function(e) {
      if (e.which == 13) {
        self.updateParam(this.value, "warning-range-hi");
      }
    });

    if (!(update_on_metric_change === false)) {
        this.warning_range_lo_controller = id_lo;
        this.warning_range_hi_controller = id_hi;
    }
    return this;
  }

  nData() {
    return this.config.fields.length;
  }

  updateBuffer() {
    if (this.buffer != null) this.buffer.stop();

    // get pairs
    var pairs = [];
    for (var i = 0; i < this.config.fields.length; i++) {
      pairs.push( [this.metric, this.config.fields[i].link] );
    }

    // get the data link
    var link = new MetricStreamLink($SCRIPT_ROOT + this.stream_link, this.stream, this.config.instance, this.config.fields, [this.metric]);
    // get the data poll
    //var poll = new D3DataPoll(new D3DataLink(link), this.step);

    // data source
    var source = new D3DataSource(link, -1);

    // get the data buffer
    this.buffer = new D3DataBuffer(source, pairs, 1, this.listeners); 
    // run with the most recent data
    var start = new Date();
    start.setSeconds(start.getSeconds() - 2 * this.step / 1000); // ms -> s
    this.buffer.run(start);
  }

  run() {
    // get the step size 
    var link = new MetricStreamLink($SCRIPT_ROOT + this.stream_link, this.stream, this.config.instance, this.config.fields, [this.metric]);
    var self = this;
    d3.json(link.step_link(), function(data) {
      self.step = data.step; 
      if (self.step < 1000) self.step = 1000;
      self.updateBuffer();
    });
  }

  addListener(f) {
    this.listeners.push(f);
  }

  layoutHistogram(yLabel) {
    var n_data = this.nData();
    var title = this.title + " " + this.metric;
    var ret = {
      title: titleize(title),
      xaxis: {
        title: this.metric,
        range: this.range
      },
      yaxis: {
        range: [0, n_data],
        title: yLabel
      }
    };
    return ret;
  }

  addHistogram(target, yLabel) {
    var n_data = this.nData();
    var layout = this.layoutHistogram(yLabel);
    var histogram =  new Histogram(n_data, target, layout);
    this.listeners.push(histogram.updateData.bind(histogram));
    this.histograms.push(histogram);
  }

  layoutScatter(xLabel) {
    var n_data = this.nData();
    var title = this.title + " " + this.metric;
    var ret = {
      title: titleize(title),
      xaxis: {
        title: xLabel
      },
      yaxis: {
        title: this.metric,
        range: this.range
      }
    };
    return ret;
  }

  addScatter(target, title, xLabel) {
    var n_data = this.nData();
    var layout = this.layoutScatter(title, xLabel);
    if (this.warning_range.length != 0) {
      var scatter = new LineChart(n_data, target, layout, this.config.metric_config[this.metric].warning_range);
    }
    else {
      var scatter = new LineChart(n_data, target, layout);
    }
    this.listeners.push(scatter.updateData.bind(scatter));
    this.scatters.push(scatter);
  }

  metricParam() {
    var metric_param = this.config.metric_config[this.metric];
    if (metric_param.range !== undefined) {
      this.range = metric_param.range;
    }
    else {
      this.range = [];
    }

    if (metric_param.warning_range !== undefined ){
      this.warning_range = metric_param.warning_range;
    }
    else {
      this.warning_range = [];
    }

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

    if (!(this.warning_range_lo_controller === undefined)) {
      if (this.warning_range.length != 0) {
        $(this.warning_range_lo_controller).val(this.warning_range[0]);
      }
      else {
        $(this.warning_range_lo_controller).val("");
      }
    }
    if (!(this.warning_range_hi_controller === undefined)) {
      if (this.warning_range.length != 0) {
        $(this.warning_range_hi_controller).val(this.warning_range[1]);
      }
      else {
        $(this.warning_range_hi_controller).val("");
      }
    }
  }

  updateParam(input, param_name) {
    // update this param
    if (param_name == "warning-range-hi") this.warning_range[1] = input;
    else if (param_name == "warning-range-lo") this.warning_range[0] = input;
    else if (param_name == "range-hi") this.range[1] = input;
    else if (param_name == "range-lo") this.range[0] = input;
    // if no valid update, just return
    else return;

    this.updatePlots();
  }

  updatePlots() {
    var histo_update = { 
      "xaxis.range": this.range,
      "xaxis.title": this.metric,
      "title": titleize(this.title + " " + this.metric)
    };
    var scatter_update = {
      "yaxis.range": this.range,
      "yaxis.title": this.metric,
      "title": titleize(this.title + " " + this.metric)
    };
    // otherwise, update plots
    for (var i = 0; i < this.histograms.length; i++) {
      this.histograms[i].reLayout(histo_update);
    }
    for (var i = 0; i < this.scatters.length; i++) {
      this.scatters[i].reLayout(scatter_update);
      if (this.warning_range.length != 0) {
        this.scatters[i].updateRange(this.warning_range);
      }
    }
  }

  // update the data type
  updateMetric(input) {
    this.metric = input;
    this.metricParam();
    this.updatePoll();
    this.updatePlots();
  }

}

function titleize(str) {
    return str.replace(/_/g, ' ').replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

