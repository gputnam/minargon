import {WarningRange, DataTrace, ScatterYAxis} from "./chart_proto.js";

// All code here relies on plotly.js being loaded
// TODO: make use of module imports

// class managing a plotly timeseries scatter plot
export class TimeSeriesScatter {

    constructor(target, plot_title, titles, n_data, y_axes, x_range) {
      this.target = target;
      this.n_data = n_data;

      this.y_axes = y_axes;

      this.data = [];
      this.times = [];
      this.timestamps = [];

      this.data_traces = [];

      for (var i = 0; i < n_data; i++) {
        this.data.push( [] );
        this.times.push( [] );
        this.timestamps.push( [] );
        this.data_traces.push(new DataTrace(titles[i], this.y_axes[0], this.data[i], this.times[i]));
      }

      this.warning_lines = [];

      this.x_range = x_range;
      this.plot_title = plot_title;
      
      this.draw();
    }

    set_y_axes(y_axes) {
      this.y_axes = y_axes;
      var layout = {};
      for (var i = 0; i < this.y_axes.length; i++) {
        layout[this.y_axes[i].layout_name()] = this.y_axes[i].build();
      }
      Plotly.relayout(this.target, layout);
    }

    setXRange(range) {
      this.x_range = range;
      var layout_update = {
        xaxis: {
          range: this.x_range,
          title: "Time"
        }
      };
      Plotly.relayout(this.target, layout_update);
    }

    build_layout() {
     // build the layout for this plot
     var layout = {};
     layout["name"] = this.plot_title;
     layout["xaxis"] = {
       range: this.x_range,
       title: "Time"
     };
     for (var i = 0; i < this.y_axes.length; i++) {
       layout[this.y_axes[i].layout_name()] = this.y_axes[i].build();
     }
     return layout;
    }

    add_trace(title, y_axis_index) {
      // New data point! Increment the number
      this.n_data += 1;
      // add in storage
      this.data.push([]);
      this.times.push([]); 
      this.timestamps.push([]);
      // add the trace
      this.data_traces.push(new DataTrace(title, this.y_axes[y_axis_index], this.data[this.n_data-1], this.times[this.n_data-1]));
      this.titles.push(title);

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
    }

    updateTitles(titles) { 
      this.titles = titles;
      for (var i = 0; i < this.titles.length; i++) {
        var trace_update = {
          name: this.titles[i]
        };
        Plotly.restyle(this.target, trace_update, i);
      }
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
          this.timestamps[i][j] = Math.round(dat[0] / 1000); // ms -> s
          this.times[i][j] = moment.unix(Math.round(dat[0] / 1000)) // ms -> s
            .format("YYYY-MM-DD HH:mm:ss");
          this.data[i][j] = dat[1];
         }
      }
      this.redraw();
      this.updateWarningLines();
    }

    redraw() {
      Plotly.redraw(this.target);
    }

    addWarningLine(name, range) {
      this.warning_lines.push(new WarningRange(name, range, this.y_axes[0]));
      // get the time range over which to draw this line
      var time_range = this.time_range();
      // make the trace
      var traces = this.warning_lines[this.warning_lines.length-1].trace(time_range);
      // draw them 
      Plotly.addTraces(this.target, traces);
    }

    deleteWarningLines() {
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
    updateWarningLines() {
      var time_range = this.time_range();
      for (var i = 0; i < this.warning_lines.length; i++) {
        this.warning_lines[i].trace(time_range);
      }
      Plotly.redraw(this.target);
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
          min_time = moment.unix(Math.min(...min_times)).format("YYYY-MM-DD HH:mm:ss");
        }
        else min_time = -1;
        if (max_times.length > 0) { 
          max_time = moment.unix(Math.max(...max_times)).format("YYYY-MM-DD HH:mm:ss");
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
    constructor(n_data, target, layout, range) {
        this.data = new Array(n_data);
        this.n_data = n_data;
        this.target = target;
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
                x: [0, this.n_data-1],
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
                x: [0, this.n_data-1],
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
        var x = [];
        for (var i = 0; i < this.n_data; i++) {
            x.push(i);
        }
        var ret = [{
            x: x,
            y: this.data,
            type: "scatter",
            name: "Data",
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

