import * as Data from "./Data.js";
import * as DataLink from "./DataLink.js";
import {FunctorScatter} from "./functor_chart.js";

// re-export DataLink
export {DataLink, Data};

export var available_functions = [
  function(a, b) {return a + b;},
  function(a, b) {return a - b;},
  function(a, b) {return a * b;},
  function(a, b) {return a / b;},
  function(a, b) {return Math.atan(a / b) * 180 / Math.PI;},
  function(a, b) {return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));}
];

export var available_function_names = [
  "{A} + {B}",
  "{A} - {B}",
  "{A} * {B}",
  "{A} / {B}",
  "arctan({A} / {B}) [deg]",
  "sqrt({A}^2 + {B}^2)"
];

// This file contains a class for plotting the function between two different metrics

// FunctorController: manages a time scatter x-y plot for two metrics

export class FunctorController {
  // target: the div-id (including the '#') where the cubism plots will
  //         be drawn
  constructor(target, linkA, nameA, linkB, nameB, func, fname) {
    this.target = target;
    this.max_data = 1000;

    this.linkA = linkA;
    this.nameA = nameA;

    this.linkB = linkB;
    this.nameB = nameB;

    this.link = new Data.D3DataChain([linkA, linkB]);

    // plot title
    var plot_title = fname.replace("{A}", nameA).replace("{B}", nameB);
    // make a new plotly scatter plot
    this.scatter = new FunctorScatter(target, plot_title, nameA, nameB, func); 
    this.scatter.draw();

    this.is_live = true;
    this.is_running = false;
  }

  setTitle(title) {
    this.scatter.title = title;
  }

  setYRange(lo, hi) {
    this.scatter.yrange = [lo, hi];    
  }

  // ---------------------------------------------------------------------------
  // Internal function: grap the time step from the server and run a
  // callback
  getTimeStep(callback) {
    var self = this;
    this.linkA.get_step(function(dataA) {
        self.linkB.get_step(function(dataB) {
          callback(self, dataA.step, dataB.step);
        });
    });
  }

  // ---------------------------------------------------------------------------
  // start running
  run() {
    this.is_running = true;
    this.getTimeStep(function(self, stepA, stepB) {
      self.updateStep(stepA, stepB);
      self.updateData(self.linkA, self.linkB);
    });
  }
  // ---------------------------------------------------------------------------
  // update the data step
  updateStep(stepA, stepB) {
    var step = Math.max(stepA, stepB);  
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
    
    self.listDateChangeEVTTime = 0;
    $(id_toggle).on("date-change", function() {
      var fire = true;
      if (event.timeStamp - self.listDateChangeEVTTime < 500){
        fire = false;
      }
      self.listDateChangeEVTTime = event.timeStamp;
      if (!fire) return;

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

