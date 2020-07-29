import * as Data from "./Data.js";
import * as DataLink from "./DataLink.js";
import {CorrelationScatter} from "./correlation_chart.js";

// re-export DataLink
export {DataLink, Data};

// This file contains a class for plotting the correlation between two different metrics

// CorrelationController: manages a time scatter x-y plot for two metrics

export class CorrelationController {
  // target: the div-id (including the '#') where the cubism plots will
  //         be drawn
  // links: the DataLink object which will be used to get data to plot
  // metric_config: The metric configuration for the associated plot
  constructor(target, linkX, titleX, configX, linkY, titleY, configY) {
    this.target = target;
    this.max_data = 1000;

    this.linkX = linkX;
    this.titleX = titleX;
    this.configX = configX;

    this.linkY = linkY;
    this.titleY = titleY;
    this.configY = configY;

    this.link = new Data.D3DataChain([linkX, linkY]);

    // plot title
    var plot_title = linkX.name() + " vs. " + linkY.name();
    // make a new plotly scatter plot
    this.scatter = new CorrelationScatter(target, plot_title, titleX, titleY); 
    this.scatter.draw();

    this.is_live = true;
    this.is_running = false;
  }

  // ---------------------------------------------------------------------------
  // Internal function: grap the time step from the server and run a
  // callback
  getTimeStep(callback) {
    var self = this;
    this.linkX.get_step(function(dataX) {
        self.linkY.get_step(function(dataY) {
          callback(self, dataX.step, dataY.step);
        });
    });
  }

  // ---------------------------------------------------------------------------
  // start running
  run() {
    this.is_running = true;
    this.getTimeStep(function(self, stepX, stepY) {
      self.updateStep(stepX, stepY);
      self.updateData(self.linkX, self.linkY);
    });
  }
  // ---------------------------------------------------------------------------
  // update the data step
  updateStep(stepX, stepY) {
    var step = Math.max(stepX, stepY);  
    if (step < 1000) step = 1000;
    this.step = step;
  }

  // ---------------------------------------------------------------------------
  // update the data link and start polling for new data
  updateData() {
    // reset the poll
    if (!(this.buffer === undefined) && this.buffer.isRunning()) {
      this.buffer.stop();
    }

    // make a new buffer
    // get the poll
    var poll = new Data.D3DataPoll(this.link, this.step, []);

    // wrap with a buffer
    this.buffer = new Data.D3DataBuffer(poll, this.max_data, [this.scatter.updateData.bind(this.scatter)]);

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

