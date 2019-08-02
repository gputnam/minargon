import * as Data from "./Data.js";
import * as DataLink from "./DataLink.js";
import * as Chart from "./charts.js";
import {ScatterYAxis} from "./chart_proto.js";

// re-export DataLink
export {DataLink, Data};

// This file contains a few classes for plotting time-series data using cubism strip charts

// There are three available classes used for managing cubism:
// CubismController: manages a list of strip charts from a provided
//                   DataLink along with a provided metric_config object 
//
// PlotlyController: manages a time-series scatter plot from a provided 
//                   DataLink along with a provided metric_config object 

// Each of these classes manages a D3DataBuffer object to get data and
// displays a number of strip charts to visualize the data. Each class
// also manages interfaces with the webpage UI for specifying the format
// of the plots to be shown.


// To set up each class, call the contructor, then connect a number UI
// components (using the various "xxxController" functions), then call
// run()
//
// Alternatively, you can also set them up through the
// GroupConfigController if you want them to handle a group of metrics
// -----------------------------------------------------------------------------
export class PlotlyController {
  // target: the div-id (including the '#') where the cubism plots will
  //         be drawn
  // links: the DataLink object which will be used to get data to plot
  // metric_config: The metric configuration for the associated plot
  constructor(target, link, titles, metric_config) {
    this.link = link;
    this.target = target;
    this.max_data = 1000;
    this.titles = titles;
    // title of plot is link name
    var plot_title = link.name();
    // make a new plotly scatter plot
    this.scatter = new Chart.TimeSeriesScatter(target); 
    // set the plot title
    this.scatter.title = plot_title;
    this.scatter.draw();
    // appply config
    this.updateMetricConfig(metric_config, false);
    // set the data
    for (var i = 0; i < titles.length; i ++) {
      this.scatter.add_trace(titles[i], 0);
    }

    this.is_live = true;
    this.is_running = false;
  }
  // ---------------------------------------------------------------------------
  // commuicate to the "config" wrapper -- whether or not the # of instances in this class should be restricted
  restrictNumInstances() {
    return true;
  }
  // ---------------------------------------------------------------------------
  buildScatterAxes() {
    var ret = [];
    for (var i = 0; i < this.metric_config.length; i++) {
      var title = "";
      if (this.metric_config[i].yTitle !== undefined) {
        if (this.metric_config[i].unit !== undefined) {
          title = this.metric_config[i].yTitle + " [" + this.metric_config[i].unit + "]";
        }
        else {
          title = this.metric_config[i].yTitle;
        }
      }
      else {
        title = this.titles[i];
      }
      var range;
      if (this.metric_config[i].range !== undefined && this.metric_config[i].range.length == 2) {
        range = this.metric_config[i].range;
      }
    
      ret.push(new ScatterYAxis(title, range, i));
    }
    return ret;
  }
  // ---------------------------------------------------------------------------
  // Internal function: grap the time step from the server and run a
  // callback
  getTimeStep(callback) {
    var self = this;
    this.link.get_step(function(data) {
        callback(self, data.step);
    });
  }
  // ---------------------------------------------------------------------------
  // start running
  run() {
    this.is_running = true;
    this.getTimeStep(function(self, step) {
      self.updateStep(step);
      self.updateData(self.link);
    });
  }
  // ---------------------------------------------------------------------------
  // Functions called by the GroupConfigController
  // update the titles
  updateTitles(titles) {
    this.scatter.titles = titles;
    this.titles = titles;
  }
  // ---------------------------------------------------------------------------
  // update the metric config option
  updateMetricConfig(config, do_append) {
    if (do_append === undefined || !do_append) {
      this.metric_config = [config];
    }
    else {
      this.metric_config.push(config);
    }
    // update the y-axis
    this.scatter.y_axes = this.buildScatterAxes();
    
    // update the warning lines
    this.scatter.delete_warning_lines();
    if (this.metric_config.length == 1 && this.metric_config[0].warningRange !== undefined) {
      this.scatter.add_warning_line(this.metric_config[0].yTitle, this.metric_config[0].warningRange, 0);
    }
  }
  // ---------------------------------------------------------------------------
  // update the data step
  updateStep(step) {
    if (step < 1000) step = 1000;
    this.step = step;
  }
  // ---------------------------------------------------------------------------
  // set the step for the first time
  setStep(step) {
    this.updateStep(step);
  }
  // ---------------------------------------------------------------------------
  // update the data link and start polling for new data
  updateData(link) {
    this.link = link;

    // reset the poll
    if (!(this.buffer === undefined) && this.buffer.isRunning()) {
      this.buffer.stop();
    }

    // make a new buffer
    // get the poll
    var poll = new Data.D3DataPoll(this.link, this.step, []);

    // get the data source
    //var source = new Data.D3DataSource(this.link, -1);

    // wrap with a buffer
    this.buffer = new Data.D3DataBuffer(poll, this.max_data, [this.scatter.updateData.bind(this.scatter), this.setTimeAxes.bind(this)]);
    // run it
    this.runBuffer();
  }
 
  setDataRange(start, stop) {
    this.is_live = false;
    this.start = start;
    this.end = end;
  }

  // ---------------------------------------------------------------------------
  // Tell the buffer to get data for a specific time range
  getData(start, stop) {
    console.log("we are getting data")
    this.buffer.stop();
    this.buffer.getData(start, stop);
  }
  // ---------------------------------------------------------------------------
  // Connect setting the time range of the data to be shown to an HTML
  // form
  // id_start: The id of the datatimepicker controlled form field which
  //           holds the start time
  // id_end: The id of the datatimepicker controlled form field which
  //         folds the end time
  // id_toggle: The id of the toggle object which could either specify
  //            "live" -- update in real time, or "lookback" -- get data
  //            from the id_start/id_end time range
  timeRangeController(id_start, id_end, id_toggle) {
    var self = this;
    
    $(id_toggle).on("date-change", function() {
      var toggle_val = $(id_toggle).val();
      if (toggle_val == "live" ) {
        self.is_live = true;
      }
      else if (toggle_val == "lookback") {
        self.start = $(id_start).datetimepicker('getValue');
        self.end = $(id_end).datetimepicker('getValue');
        self.is_live = false;
        // stop the buffer
        if (self.buffer.isRunning()) {
          self.buffer.stop();
        }
      }
      else if (toggle_val == "hour"){
        var d = new Date();
        d.setHours(d.getHours() -1);
        self.start = d;
        self.end = Date.now();
        self.is_live = false;
        // stop the buffer
        if (self.buffer.isRunning()) {
          self.buffer.stop();
        }

      }
      else if (toggle_val == "day"){
        var d = new Date();
        d.setDate(d.getDate() -1);
        self.start = d;
        self.end = Date.now();
        self.is_live = false;
        // stop the buffer
        if (self.buffer.isRunning()) {
          self.buffer.stop();
        }

      }

      self.runBuffer();
    });
    return this;
  }
  // ---------------------------------------------------------------------------
  downloadDataController(id) {
    var self = this;
    $(id).click(function() {
      self.download("data.json", JSON.stringify(self.downloadFormat()));
    });
    return this;
  }

  addLink(link, config, name) {
    this.link = this.link.add(link);
    this.titles.push(name);
    this.updateMetricConfig(config, true);
    this.scatter.add_trace(name, this.metric_config.length - 1); 
    if (this.is_running) {
      this.updateData(this.link);
    }
  }

  treeSelectController(id, type) {
    var self = this;
    $(id).on('nodeSelected', function(event, node) {
      if (type == "postgres") {
        if (node.ID === undefined) return;
        // collapse the tree
        $(id).treeview('collapseAll', { silent: true });
        // make the link and get the config object
        var postgres_link = new DataLink.PostgresStreamLink($SCRIPT_ROOT, node.database, node.ID)

        // get the config and then finish updating the plot
        d3.json(postgres_link.config_link(), function(config) {
          self.addLink(new Data.D3DataLink(postgres_link), config.metadata, node.name);
        });
      }
    });
    return this;
  }
  // ---------------------------------------------------------------------------
  runBuffer() {
    if (this.is_live) {
      // set the start
      // to be on the safe side, get back to ~1000 data points
      this.start = new Date(); 
      this.start.setSeconds(this.start.getSeconds() - this.step * this.max_data / 1000); // ms -> s
      this.buffer.start(this.start);
    }
    else {
      this.buffer.getData(this.start, this.end);
    }
  }
  // ---------------------------------------------------------------------------
  setTimeAxes() {
    if (this.is_live) {
      // let plotly set the x-range
      this.scatter.x_range = undefined;
    }
    else {
      // set it ourselves
      this.scatter.x_range = [moment(this.start).format("YYYY-MM-DD HH:mm:ss"), moment(this.end).format("YYYY-MM-DD HH:mm:ss")];
    }
  }
  // ---------------------------------------------------------------------------
  downloadFormat() {
    // get the number of input streams controlled by this plot
    var n_data = this.link.accessors().length;
    var ret = {};
    for (var i = 0; i < n_data; i++) {
      ret[this.titles[i]] = this.buffer.buffers[i].get(0, this.buffer.buffers[i].size);
    }
    return ret;
  }
  // ---------------------------------------------------------------------------
  download(filename, data) {
    var blob = new Blob([data], {type: 'text/csv'});
    if(window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, filename);
    }
    else{
      var elem = window.document.createElement('a');
      elem.href = window.URL.createObjectURL(blob);
      elem.download = filename;        
      document.body.appendChild(elem);
      elem.click();        
      document.body.removeChild(elem);
    }
  }
}
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

export class CubismController {
  // target: the div-id (including the '#') where the cubism plots will
  //         be drawn
  // NOTE: the following 3 parameters are passed directly to the TimeSeries class
  // timeseries_config: DataConfig object for "TimeSeries" -- see
  //                    constructor
  // metric: the name of the metric to be shown in each time-series 
  // height: the height of the cubism time strip plot to be drawn
  constructor(target, data_link, titles, metric_config, height) {
    this.height = height;
    this.titles = titles;
    this.metric_config = metric_config;
    this.data_link = data_link;
    this.target = target;

    this.range = [];

    // max data
    this.max_data = 10000;
  }

  // commuicate to the "config" wrapper -- whether or not the # of instances in this class should be restricted
  restrictNumInstances() {
    return true;
  }

  // Internal function: grap the time step from the server and run a
  // callback
  getTimeStep(callback) {
    var self = this;
    this.data_link.get_step(function(data) {
        callback(self, data.step);
    });
  }

  // set the step for the first time
  setStep(step) {
    if (step < 1000) step = 1000;
    this.step = step;
    this.context = create_cubism_context(this.target, this.step);
  }

  // Internal function: get the time step and build the cubism context 
  buildContext(callback) {
    this.getTimeStep(function(self, step) {
      self.setStep(step);
      callback(self);
    });
  }

  // Internal function: set the default configuration for the plot
  // display based on the input metric
  set() {
    this.metricParam();
    return this;
  }

  // Connect the strip chart height to a HTML form field
  // id: the jQuery specified of the HTML form field
  heightController(id) {
    var self = this;
    $(id).change(function() { self.updateParam(this.value, "height"); });
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

  // Internal function: hook up cubism with the link function
  onClick(name, index) {
    if (this.linkFunction === undefined) return;
    // check if link function is defined
    var link = this.linkFunction(index);
    if (!(link === undefined)) {
        // go there
        window.location.href = $SCRIPT_ROOT + "/" + link;
    }
  }

  // set the link function to be used by this controller when the user
  // clicks on one of the horizon charts
  setLinkFunction(func) {
    this.linkFunction = func;
  }

  setGetTitle(func) {
    this.getTitle = func;
  }

  // Internal function: set the configuration of the plots to be
  // displayed from the default configuration of the specified metric
  // (if such configuration exists)
  metricParam() {
    var metric_param = this.metric_config;
    if (metric_param === undefined) {
      metric_param = {};
    }
    if (!(metric_param.display_range === undefined)) {
      this.range = metric_param.display_range; 
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
  // use updateParam to update thresholds.
  // Internal function: update a display parameter of the cubism charts
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

  // Internal function: start of the D3DataBuffer and collect data
  // remove_old: whether to delete the existing cubism plots
  updateData(data_link, remove_old) {
    this.data_link = data_link;

    // if no streams, don't do anything
    if (this.data_link === null || this.data_link === undefined) {
      return;
    }

    if (remove_old === true) {
        delete_horizons(this);
    }

    // reset the poll
    if (!(this.buffer === undefined)) {
      this.buffer.stop();
    }

    // make a new buffer
    // to be on the safe side, get back to ~1000 data points
    var start = new Date(); 
    start.setSeconds(start.getSeconds() - this.step * this.max_data / 1000); // ms -> s
    this.cubism_on = false;

    // first build the poll
    var poll = new Data.D3DataPoll(this.data_link, this.step, []);

    // get the data source
    //var source = new Data.D3DataSource(this.data_link, -1);

    // wrap with a buffer
    this.buffer = new Data.D3DataBuffer(poll, this.max_data, [this.startCubism.bind(this)]);
    this.buffer.start(start);
  }

  // Functions called by the GroupConfigController

  // update the data step
  updateStep(step) {
    if (step < 1000) step = 1000;
    this.step = step;
    this.context.step(step);
  }

  // update the titles
  updateTitles(titles) {
    this.titles = titles;
  }

  // update the metric config option
  updateMetricConfig(metric_config) {
     this.metric_config = metric_config;
     this.metricParam();
  }

  // Internal function: build the functions to link data between the D3DataBuffer and cubism
  dataLinks(buffers) {
    var ret = [];
    var n_data = this.data_link.accessors().length;
    for (var j  = 0; j < n_data; j++) {
      ret.push( build_data_link(j, buffers[j]) );
    }
    return ret;
  }

  // Internal function: run cubism for the first time
  startCubism(buffers) {
    if (!this.cubism_on) {
      this.cubism_metrics = add_metrics(this, this.dataLinks(buffers), this.titles);
      this.cubism_on = true;
    }
  }

  // Start running cubism
  run() {
    this.buildContext(function(self) {
      self.updateData(self.data_link);
    });
  }

}

// Helper functions used by the CubismController class

// add in metrics w/ a horizon chart to the provided target
function add_metrics(controller, data_links, titles) {
  // add new metrics
  var data = data_links.map(function(data_link, i) { 
    // use the provided title if there is one
    var metric = controller.context.metric(data_link.bind(data_link), titles[i]);
    //var metric = controller.context.metric(data_link.bind(data_link));
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

// create the cubism plots for the first time
function create_cubism_context(target, step) {
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

  return context;
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

