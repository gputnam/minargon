import {WarningRange, DataTrace, ScatterYAxis} from "./chart_proto.js";

// All code here relies on plotly.js being loaded
// TODO: make use of module imports

// class managing a plotly timeseries scatter plot
export class TimeSeriesScatter {

    constructor(target) {
      this.target = target;
      this.n_data = 0;

      this.data = [];
      this.times = [];
      this.timestamps = [];
      this.data_traces = [];
      this.warning_lines = [];
      this.is_drawn = false;
      this._y_axes = [];
      this._trace_names = [];
      this.x_domain_hi = 1;

      // whether to crop data points that are too old
      this.crop_old_data = false;
      // range of what to crop
      this.crop_range = -1;
    }

    set title(title) {
      this._title = title;
      if (this.is_drawn) {
        var layout = {};
        layout["name"] = this._title;
        Plotly.relayout(this.target, layout);
      }
    }

    set y_axes(y_axes) {
      this._y_axes = y_axes;
      if (this.is_drawn) {
        var layout = {};
        for (var i = 0; i < this._y_axes.length; i++) {
          layout[this._y_axes[i].layout_name()] = this._y_axes[i].build();
        }
        if (this._y_axes.length > 2) {
          this.x_domain_hi = 1; // - 0.15 * (this._y_axes.length - 2);
        }
        else {
          this.x_domain_hi = 1;
        }

        layout["xaxis.domain"] = [0, this.x_domain_hi];
        
        Plotly.relayout(this.target, layout);
      }
    }

    set x_range(range) {
      this._x_range = range;
      if (this.is_drawn) {
        var layout_update = {
          xaxis: {
            range: this._x_range,
            title: "Time (CST/GMT-6)",
            domain: [0, this.x_domain_hi]
          }
        };
        Plotly.relayout(this.target, layout_update);
      }
    }

    set trace_names(names) {
      this._trace_names = names;
      for (var i = 0; i < this._trace_names.length; i++) {
        var trace_update = {
          name: this._trace_names[i]
        };
        Plotly.restyle(this.target, trace_update, i);
      }
    }

    add_trace(title, y_axis_index) {
      // New data point! Increment the number
      this.n_data += 1;
      // add in storage
      this.data.push([]);
      this.times.push([]); 
      this.timestamps.push([]);
      // add the trace
      this.data_traces.push(new DataTrace(title, this._y_axes[y_axis_index], this.data[this.n_data-1], this.times[this.n_data-1]));
      this._trace_names.push(title);

      // add the trace
      Plotly.addTraces(this.target, this.data_traces[this.n_data-1].trace(), this.n_data-1);
    }

    draw() {
      var traces = [];
      for (var i = 0; i < this.n_data; i++) {
        traces.push(this.data_traces[i].trace());
      }

      var layout = this.build_layout();

      Plotly.newPlot(this.target, traces, layout);

      this.is_drawn = true;
    }

    // update the data and redraw the plot
    // data should be a single time stream
    updateData(buffers) {
      for (var i = 0; i < buffers.length; i++) {
        var buffer = buffers[i];
        this.data[i].length = 0;
        this.times[i].length = 0;
        this.timestamps[i].length = 0;
        for (var j = 0; j < buffer.size; j++) {
          var dat = buffer.get(j);

          // avoid any big skips in time if configured to
          if (this.crop_old_data && this.crop_range > 0) {
            if (j > 0 && Math.abs(this.timestamps[i][j] - this.timestamps[i][j-1]) > this.crop_range) {
              break;
            }
          }
          this.timestamps[i][j] = Math.round(dat[0] / 1000); // ms -> s
          this.times[i][j] = moment.unix(Math.round(dat[0] / 1000)) // ms -> s
            .tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
          this.data[i][j] = dat[1];
         }
      }
      this.update_warning_lines();
      this.redraw();
    }

    redraw() {
      // Plotly.redraw(this.target);
    }

    add_warning_line(name, range, y_axis_index) {
      this.warning_lines.push(new WarningRange(name, range, this._y_axes[y_axis_index]));
      // get the time range over which to draw the warning line line
      var time_range = this.time_range();
      Plotly.addTraces(this.target, this.warning_lines[this.warning_lines.length-1].trace(time_range));
    }

    delete_warning_lines() {
      // get rid of all of the warning lines

      // get the indexes of the warning line traces -- they start right after the data
      var to_delete = [];
      for (var i = 0; i < this.warning_lines.length; i++) {
        to_delete.push(2*i + this.n_data)
        to_delete.push(2*i + 1 + this.n_data)
      }
      if (to_delete.length > 0) {
        Plotly.deleteTraces(this.target, to_delete);
      }
      this.warning_lines = [];
    }

    // update warning lines to a new time
    update_warning_lines() {
      var time_range = this.time_range();
      for (var i = 0; i < this.warning_lines.length; i++) {
        this.warning_lines[i].trace(time_range);
      }
    }

    build_layout() {
      // build the layout for this plot
      var layout = {};
      layout["name"] = this.plot_title;
      layout["xaxis"] = {
        range: this._x_range,
        title: "Time (CST/GMT-6)"
      };
      for (var i = 0; i < this._y_axes.length; i++) {
        layout[this._y_axes[i].layout_name()] = this._y_axes[i].build();
      }
      if (this._y_axes.length > 1) {
        layout.xaxis.domain = [0, this.x_domain_hi];
      }
      return layout;
    }


    time_range() {
        var min_times = [];
        var max_times = [];
        for (var i = 0; i < this.n_data; i++) {
          if (this.times[i].length > 0) min_times.push(this.timestamps[i][0]);
        }
        for (var i = 0; i < this.n_data; i++) {
          if (this.times[i].length > 0) max_times.push(this.timestamps[i][this.times[i].length-1]);
        }
        var min_time; var max_time;
        if (min_times.length > 0) {
          min_time = moment.unix(Math.min(...min_times)).tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
        }
        else min_time = -1;
        if (max_times.length > 0) { 
          max_time = moment.unix(Math.max(...max_times)).tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
        }
        else max_time = 10;
        return [min_time, max_time];
    }
}

// class managing a plotly histogram
// Class managing a list of time series that plots a histogram (in
// plotly) of the most recent values across that time series 
export class Histogram {
    // n_data: the number of time series to be used
    // target: the id of the div to be drawn in (without the '#')
    // layout: the layout of the plotly histogram as defined in plotly
    //         NOTE: this variable is passed directly to the
    //         Plotly.newPlot() function 
    constructor(n_data, target, layout) {
        this.data = new Array(n_data);
        this.target = target;
        this.draw(layout);
    }
   
    // Internal function: draws the histogram for the first time
    draw(layout) {
        Plotly.newPlot(this.target, this.trace(), layout);
    }

    // update plot with a new layout
    reLayout(layout) {
        Plotly.relayout(this.target, layout);
    }

    // Internal function: get the "trace" used to draw the Plotly plot
    trace() {
        var ret = [{
            x: this.data,
            type: "histogram",
        }];
        return ret;
    }

    // update the data used in a plotly histogram
    // data: a list of CircularBuffer objects -- one for each time
    //       stream.
    // NOTE: this function is intented to be used as a listener for a 
    //       D3DataBuffer class
    updateData(data) {
        for (var i = 0; i < this.data.length; i ++) {
            if (data[i].size > 0) {
              this.data[i] = data[i].get_last()[1];
            }
            else {
              this.data[i] = 0;
            }
        }
        this.redraw();
    }

    // Internal function: redraw the plot after changing the data 
    // (as defined in this.data)
    redraw() {
         Plotly.redraw(this.target);
    }
}

// A class managing a scatter plot of a list of timeseries where the
// most recent data point in each series is shown. Note that the scatter
// plot will go in the order of the specified list of time-series
export class LineChart {
    // n_data: the number of data points to be shown
    // target: the id of the div to be drawn in (excluding the '#')
    // layout: the layout of the plotly histogram (as defined in plotly)
    // range: (optional) the warning Hi/Lo bands to be shown on the
    // 	      plotly plot
    constructor(n_data, target, layout, range, xdata, text) {
        this.data = new Array(n_data);
        this.time = new Array(n_data);
        this.n_data = n_data;
        this.target = target;
        if (xdata === undefined) {
            this.xdata = [];
            for (var i = 0; i < this.n_data; i++) {
                this.xdata.push(i);
            }
        }
        else {
            this.xdata = xdata
        }

        this.text_base = text.slice(); // clone
        this.text = text;

        this.draw(layout);

        if (!(range === undefined)) {
          this.updateRange(range);
        }
    }

    // Internal function: draw the scatter plot for the first time
    draw(layout) {
        var trace = this.trace();
        Plotly.newPlot(this.target, trace, layout);
    }

    // update plot with a new layout
    reLayout(layout) {
        Plotly.relayout(this.target, layout);
    }

    // Change the range of the scatter plot
    // range: (optional) the warning Hi/Lo bands to be shown on the
    // 	      plotly plot. If range is "undefined",
    //        then the plot will switch to the default Plotly range.
    updateRange(range) {
        if (range === undefined) {
            this.range = undefined;
            this.min = undefined;
            this.max = undefined;
            Plotly.deleteTraces(this.target, [1,2]);
            return;
        }
        var new_trace = (this.range === undefined);
        this.range = range;
        this.range_trace();
        if (new_trace) Plotly.addTraces(this.target, [this.max, this.min]);
        else Plotly.redraw(this.target);
    }

    // Internal function: reset the data for the "Warning Hi/Lo" plots 
    range_trace() {
        if (this.min === undefined) {
            this.min = {
                x: [this.xdata[0], this.xdata[this.xdata.length-1]],
                y: [this.range[0], this.range[0]],
	        type: "scatter", 
                name: "Warning Low",
                marker: { color: "green"},
            };
        }
        else {
            this.min.y[0] = this.range[0];
            this.min.y[1] = this.range[0];
        }
        if (this.max === undefined) {
            this.max = {
                x: [this.xdata[0], this.xdata[this.xdata.length-1]],
                y: [this.range[1], this.range[1]],
	        type: "scatter", 
                name: "Warning High",
                marker: { color: "red"},
            };
        }
        else {
            this.max.y[0] = this.range[1];
            this.max.y[1] = this.range[1];
        }
    }

    // Internal function: get the traces for the scatter plot
    trace() {
        var ret = [{
            x: this.xdata,
            y: this.data,
            type: "scatter",
            text: this.text,
        }];

        if (!(this.max === undefined)) ret.append(this.max);
        if (!(this.min === undefined)) ret.append(this.min);
        return ret;
    }

    // update the data used in a plotly histogram
    // data: a list of CircularBuffer objects -- one for each time
    //       stream.
    // NOTE: this function is intented to be used as a listener for a 
    //       D3DataBuffer class
    updateData(data) {
        for (var i = 0; i < this.data.length; i ++) {
            if (data[i].size > 0) {
              this.data[i] = data[i].get_last()[1];
              this.time[i] = moment.unix(data[i].get_last()[0] / 1000.).tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
              this.text[i] = "At: " + this.time[i];
              if (this.text_base) this.text[i] = this.text[i] + "<br>" + this.text_base[i];
            }
            else {
              this.data[i] = 0;
            } 
        }
        this.redraw();
    }

    // Internal function: redraw the plotly plot after changing the data
    redraw() {
         Plotly.redraw(this.target);
    }


}

