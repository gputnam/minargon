// TODO: use javascript imports
import * as Data from "./Data.js";
import * as DataLink from "./DataLink.js";
import * as Chart from "./charts.js";
import {throw_custom_error} from "./error.js";

// This class provides a scatter plot of all of the streams provided by
// the input data_link parameter.  

// This class also manages responses to the webpage UI for modifying the
// layout of the plots. By default, there are no components connected.
// They can be turned on by the various xxxController functions
export class GroupDataScatterController {
  // target: the id of the div where the scatter plot will be drawn (no
  //         '#')
  // data_link: the DataLink object which will be used to fetch data to
  //            be plotted in the line chart. The order of elements in
  //            the DataLink is the order in which different streams
  //            will be plotted
  // metric_config: configuration of the metric to be displayed. should
  //                be a JSON dictionary as described in the config.js file
  // title: title of the scatter plot
  // xLabel: label of the x axis of the scatter plot
  constructor(target, data_link, metric_config, title, xLabel, instances) {
    this.target = target;
    this.metric_config = metric_config;
    this.data_link = data_link;
    this.title = title;

    this.buffer = null;
    this.range = [];
    this.warning_range = [];
    this.listeners = [];

    this.metricParam();
    this.xLabel = xLabel;
    this.instances = instances;
    this.makeScatter();
  }

  // commuicate to the "config" wrapper -- whether or not the # of instances in this class should be restricted
  restrictNumInstances() {
    return false;
  }

  // "set" the configuration after constructing the class and calling
  // the various "xxxController" functions
  set() {
    this.metricParam();
    return this;
  }

  // Connect the range lo/hi of each plot to a pair of HTML form fields
  // id_lo: the jQuery specified of the HTML form field controlling the
  //        range minimum value
  // id_hi: the jQuery specified of the HTML form field controlling the
  //        range maximum value
  // update_on_metric_change: (optional) set to true to update the 
  //                          HTML form field value to the default
  //                          metric configuration on metric name
  //                          change. True by default. If set to false,
  //                          then this class will never write to the
  //                          specified HTML form field.
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

  // Connect the lo/hi of the warning range on the Scatter plot object
  // to a pair of HTML form fields
  // id_lo: the jQuery specified of the HTML form field controlling the
  //        range minimum value
  // id_hi: the jQuery specified of the HTML form field controlling the
  //        range maximum value
  // update_on_metric_change: (optional) set to true to update the 
  //                          HTML form field value to the default
  //                          metric configuration on metric name
  //                          change. True by default. If set to false,
  //                          then this class will never write to the
  //                          specified HTML form field.
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

  // Get the number of data points to be plotted on the histogram and
  // scatter plots
  nData() {
    return this.data_link.accessors().length;
  }

  // Internal function: starts up the D3DataBuffer objects to start
  // collecting data and plotting it in the histogram and/or scatter
  // chart
  updateBuffer() {
    if (this.buffer != null) this.buffer.stop();

    // TODO: currently we can either setup the D3DataBuffer with a Poll
    // (polling) or a Source (server side events). We should decide
    // which method to use

    // get the data poll
    var poll = new Data.D3DataPoll(this.data_link, this.step);

    // data source
    // var source = new Data.D3DataSource(this.data_link, -1);

    // get the data buffer
    this.buffer = new Data.D3DataBuffer(poll, 1, this.listeners); 
    // run with the most recent data
    var start = new Date();
    // go just a little back in time to get the first data
    // start.setSeconds(start.getSeconds() - 2 * this.step / 1000); // ms -> s
    this.buffer.start();
  }

  // Call this function to tell the class to starting getting and
  // plotting data
  // 
  // Internally determines the step size of the time-series and then
  // calls updateBuffer()
  run() {
    // if no provided streams, don't run
    if (this.data_link === undefined) {
      throw_custom_error("No data streams available for requested page");
      return;
    }

    // get the step size 
    this.data_link.get_step(function(data) {
      self.updateStep(step);
      self.updateBuffer();
    });
  }

  // Internal function: get the layout for the Plotly Scatter plot
  // managed by this class
  layoutScatter() {
    var n_data = this.nData();
    var metric_name;
    if (this.metric_config !== undefined && this.metric_config.name !== undefined) {
      metric_name = this.metric_config.name;
    }
    else {
      metric_name = "";
    }
    var title = this.title + " " + metric_name;
    // add in the latest time
    if (this.last_data_time !== undefined) {
      title += " At " + this.last_data_time.format("MM-DD-YYYY HH:mm:ss");
    }
    var ret = {
      title: titleize(title),
      xaxis: {
        title: this.xLabel
      },
      yaxis: {
        title: metric_name,
        range: this.range
      }
    };

    if (this.metric_config !== undefined && this.metric_config.format !== undefined) {
      ret.yaxis.tickformat = this.metric_config.format;
    }

    return ret;
  }

  // Makes a scatter plot to be shown with the data fetched by this class
  makeScatter() {
    var n_data = this.nData();
    var layout = this.layoutScatter();
    if (this.warning_range.length != 0) {
      var scatter = new Chart.LineChart(n_data, this.target, layout, this.warning_range, this.instances);
    }
    else {
      var scatter = new Chart.LineChart(n_data, this.target, layout, undefined, this.instances);
    }
    this.listeners.push(scatter.updateData.bind(scatter));
    this.listeners.push(this.updateTitleTime.bind(this));
    this.scatter = scatter;
  }

  updateTitleTime(data) {
    if (data.length > 0 && data[0].size > 0) {
      this.last_data_time = moment.unix(Math.round(data[0].get_last()[0] / 1000));
    }
    else {
      this.last_data_time = undefined;
    }
    this.scatter.reLayout(this.layoutScatter());
  }


  // Internal function: set the configuration of the plots to be
  // displayed from the default configuration of the specified metric
  // (if such configuration exists)
  metricParam() {
    var metric_param = this.metric_config;
    if (metric_param !== undefined && metric_param.display_range !== undefined) {
      this.range = metric_param.display_range;
    }
    else {
      this.range = [];
    }

    if (metric_param !== undefined && metric_param.warning_range !== undefined ){
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

  // Internal function: update a specified parameter using a specified
  // input
  updateParam(input, param_name) {
    // update this param
    if (param_name == "warning-range-hi") this.warning_range[1] = input;
    else if (param_name == "warning-range-lo") this.warning_range[0] = input;
    else if (param_name == "range-hi") this.range[1] = input;
    else if (param_name == "range-lo") this.range[0] = input;
    // if no valid update, just return
    else return;

    this.updatePlot();
  }

  // Internal function: upate the plots managed by this class to the
  // latest layout
  updatePlot() {
    this.scatter.reLayout(this.layoutScatter());
    if (this.warning_range.length != 0) {
      this.scatter.updateRange(this.warning_range);
    }
    //else {
    //  this.scatter.updateRange();
    //}
  }

  // Functions to be called by a wrapping MetricConfigController

  // update the step size of the data
  updateStep(step) {
    if (step < 1000) step = 1000;
    this.step = step;
  }
  // set the step size of the data for the first time
  setStep(step) {
    this.updateStep(step);
  }

  // update the metric config
  updateMetricConfig(metric_config) {
    this.metric_config = metric_config;
    this.metricParam();
    this.updatePlot();
  }

  // update the data link
  updateData(data_link, remove_old) {
    this.data_link = data_link;
    this.updateBuffer();
  }

  // update titles -- noop
  updateTitles() {}

}

// This class provides a histogram of all of the streams provided by
// the input data_link parameter.  

// This class also manages responses to the webpage UI for modifying the
// layout of the plots. By default, there are no components connected.
// They can be turned on by the various xxxController functions
export class GroupDataHistoController {
  // target: the id of the div where the scatter plot will be drawn (no
  //         '#')
  // data_link: the DataLink object which will be used to fetch data to
  //            be plotted in the line chart. The order of elements in
  //            the DataLink is the order in which different streams
  //            will be plotted
  // metric_config: configuration of the metric to be displayed. should
  //                be a JSON dictionary as described in the config.js file
  // title: title of the scatter plot
  // yLabel: label of the y axis of the scatter plot
  constructor(target, data_link, metric_config, title, yLabel) {
    this.target = target;
    this.metric_config = metric_config;
    this.data_link = data_link;
    this.title = title;
    this.yLabel = yLabel;

    this.buffer = null;
    this.range = [];
    this.listeners = [];

    this.metricParam();
    this.makeHistogram();
  }

  // commuicate to the "config" wrapper -- whether or not the # of instances in this class should be restricted
  restrictNumInstances() {
    return false;
  }

  // "set" the configuration after constructing the class and calling
  // the various "xxxController" functions
  set() {
    this.metricParam();
    return this;
  }

  // Connect the range lo/hi of each plot to a pair of HTML form fields
  // id_lo: the jQuery specified of the HTML form field controlling the
  //        range minimum value
  // id_hi: the jQuery specified of the HTML form field controlling the
  //        range maximum value
  // update_on_metric_change: (optional) set to true to update the 
  //                          HTML form field value to the default
  //                          metric configuration on metric name
  //                          change. True by default. If set to false,
  //                          then this class will never write to the
  //                          specified HTML form field.
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

  // Get the number of data points to be plotted on the histogram and
  // scatter plots
  nData() {
    return this.data_link.accessors().length;
  }

  // Internal function: starts up the D3DataBuffer objects to start
  // collecting data and plotting it in the histogram and/or scatter
  // chart
  updateBuffer() {
    if (this.buffer != null) this.buffer.stop();

    // TODO: currently we can either setup the D3DataBuffer with a Poll
    // (polling) or a Source (server side events). We should decide
    // which method to use

    // get the data poll
    var poll = new Data.D3DataPoll(this.data_link, this.step);

    // data source
    // var source = new Data.D3DataSource(this.data_link, -1);

    // get the data buffer
    this.buffer = new Data.D3DataBuffer(poll, 1, this.listeners); 
    // run with the most recent data
    var start = new Date();
    // go just a little back in time to get the first data
    // start.setSeconds(start.getSeconds() - 2 * this.step / 1000); // ms -> s
    this.buffer.start();
  }

  // Call this function to tell the class to starting getting and
  // plotting data
  // 
  // Internally determines the step size of the time-series and then
  // calls updateBuffer()
  run() {
    // if no provided streams, don't run
    if (this.data_link === undefined) {
      throw_custom_error("No data streams available for requested page");
      return;
    }

    var self = this;
    this.data_link.get_step(function(data) {
      self.step = data.step; 
      if (self.step < 1000) self.step = 1000;
      self.updateBuffer();
    });
  }

  // Internal function: get the layout for the Plotly Histogram managed
  // by this class
  layoutHistogram() {
    var n_data = this.nData();
    var metric_name;
    if (this.metric_config !== undefined && this.metric_config.name !== undefined) {
      metric_name = this.metric_config.name;
    }
    else {
      metric_name = "";
    }
    var title = this.title + " " + metric_name;
    // add in the latest time
    if (this.last_data_time !== undefined) {
      title += " At " + this.last_data_time.format("MM-DD-YYYY HH:mm:ss");
    }
    var ret = {
      title: titleize(title),
      xaxis: {
        title: metric_name,
        range: this.range
      },
      yaxis: {
        range: [0, n_data],
        title: this.yLabel
      }
    };

    if (this.metric_config !== undefined && this.metric_config.format !== undefined) {
      ret.xaxis.tickformat = this.metric_config.format;
    }

    return ret;
  }

  // Add a histogram plot to be shown with the data fetched by this
  // class
  // target: div-id of the div to contain this plot (excluding the '#')
  // yLabel: label of the y-axis on the fistogram to be shown 
  makeHistogram() {
    var n_data = this.nData();
    var layout = this.layoutHistogram();
    var histogram =  new Chart.Histogram(n_data, this.target, layout);
    this.listeners.push(histogram.updateData.bind(histogram));
    this.listeners.push(this.updateTitleTime.bind(this));
    this.histogram = histogram;
  }

  updateTitleTime(data) {
    if (data.length > 0 && data[0].size > 0) {
      this.last_data_time = moment.unix(Math.round(data[0].get_last()[0] / 1000));
    }
    else {
      this.last_data_time = undefined;
    }
    this.histogram.reLayout(this.layoutHistogram());
  }

  // Internal function: set the configuration of the plots to be
  // displayed from the default configuration of the specified metric
  // (if such configuration exists)
  metricParam() {
    var metric_param = this.metric_config;
    if (metric_param !== undefined && metric_param.display_range !== undefined) {
      this.range = metric_param.display_range;
    }
    else {
      this.range = [];
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
  }

  // Internal function: update a specified parameter using a specified
  // input
  updateParam(input, param_name) {
    // update this param
    if (param_name == "range-hi") this.range[1] = input;
    else if (param_name == "range-lo") this.range[0] = input;
    // if no valid update, just return
    else return;

    this.updatePlot();
  }

  // Internal function: upate the plots managed by this class to the
  // latest layout
  updatePlot() {
    this.histogram.reLayout(this.layoutHistogram());
  }

  // Functions to be called by a wrapping MetricConfigController

  // update the step size of the data
  updateStep(step) {
    if (step < 1000) step = 1000;
    this.step = step;
  }
  // set the step size of the data for the first time
  setStep(step) {
    this.updateStep(step);
  }

  // update the config
  updateMetricConfig(metric_config) {
    this.metric_config = metric_config;
    this.metricParam();
    this.updatePlot();
  }

  // update the data link
  updateData(data_link, remove_old) {
    this.data_link = data_link;
    this.updateBuffer();
  }

  // update titles -- noop
  updateTitles() {}


}

// Internal function: make a string into a title by capitalizing things
function titleize(str) {
    return str.replace(/_/g, ' ')
              .replace(/\w\S*/g, function(txt){
                 return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
               })
              .replace(/\w\S*/g, function(txt){
                   return txt.replace(/^Tpc$/g, "TPC")
                   .replace(/^Crt$/g, "CRT")
                   .replace(/^Pmt$/g, "PMT")
                   .replace(/^Chan$/g, "CHAN")
                   .replace(/^Asic$/g, "ASIC")
                   .replace(/^Femb$/g, "FEMB")
                   .replace(/^Rms$/g, "RMS")
                   .replace(/^Dnoise$/g, "DNoise");
 
               });
}

