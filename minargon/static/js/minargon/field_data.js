class FieldData {
  constructor(title, config, metric, step_ind) {
    this.name = name;
    this.config = config;
    this.title = title;
    this.poll = null;
    this.metric = metric;
    this.step_ind = step_ind;
    this.metricParam();
    this.listeners = [];
    this.histograms = [];
    this.scatters = [];
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

  updatePoll() {
    if (this.poll != null) this.poll.stop();

    var Fdata_link = this.config.data_link;
    var data_link = window[Fdata_link](this.metric, this.config.instance, this.config.fields); 
    // sleep for timeout time
    var step =  this.config.steps[this.step_ind] * 1e3 /* s -> ms */;
    var timeout = step;
    this.poll = new D3DataPoll(data_link, timeout, this.listeners, step, this.config.server_delay);
    this.poll.run();
  }

  addListener(f) {
    this.listeners.push(f);
  }

  layoutHistogram(yLabel) {
    var n_data = this.nData();
    var title = this.title + " " + this.metric;
    return {
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
    return {
      title: titleize(title),
      xaxis: {
        title: xLabel
      },
      yaxis: {
        title: this.metric,
        range: this.range
      }
    };
  }

  addScatter(target, title, xLabel) {
    var n_data = this.nData();
    var layout = this.layoutScatter(title, xLabel);
    var scatter = new LineChart(n_data, target, layout, this.config.metrics[this.metric].warning_range);
    this.listeners.push(scatter.updateData.bind(scatter));
    this.scatters.push(scatter);
  }

  metricParam() {
    var metric_param = this.config.metrics[this.metric];
    this.range = metric_param.range;
    this.warning_range = metric_param.warning_range;

    // set in range values
    if (!(this.range_lo_controller === undefined)) {
      $(this.range_lo_controller).val(this.range[0]);
    }
    if (!(this.range_hi_controller === undefined)) {
      $(this.range_hi_controller).val(this.range[1]);
    }

    if (!(this.warning_range_lo_controller === undefined)) {
      $(this.warning_range_lo_controller).val(this.warning_range[0]);
    }
    if (!(this.warning_range_hi_controller === undefined)) {
      $(this.warning_range_hi_controller).val(this.warning_range[1]);
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
      this.scatters[i].updateRange(this.warning_range);
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

