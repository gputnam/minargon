// class to handle a pair of warning hi/lo lines
export class WarningRange {
  constructor(name, range, y_axis) {
    this.name = name;
    this.range = range;
    this.y_axis = y_axis;
    this.min = undefined;
    this.max = undefined;
  }

  trace(time_range) {
    var min_time = time_range[0];
    var max_time = time_range[1];
    // if the traces are new, return them to be drawn
    var do_ret = (this.min === undefined || this.max === undefined);
    if (this.min === undefined) {
      this.min = {
	x: [min_time, max_time],
	y: [this.range[0], this.range[0]],
	type: "scatter", 
	name: "Warning Low",
	marker: { color: "green"},
	yaxis: this.y_axis.trace_name()
      };
    }
    else {
      this.min.y[0] = this.range[0];
      this.min.y[1] = this.range[0];
      this.min.x[0] = min_time;
      this.min.x[1] = max_time;
    }
    if (this.max === undefined) {
      this.max = {
	x: [min_time, max_time],
	y: [this.range[1], this.range[1]],
	type: "scatter", 
	name: "Warning High",
	marker: { color: "red"},
	yaxis: this.y_axis.trace_name()
      };
    }
    else {
      this.max.y[0] = this.range[1];
      this.max.y[1] = this.range[1];
      this.max.x[0] = min_time;
      this.max.x[1] = max_time;
    }
    if (do_ret) return [this.min, this.max];
  }
}


var YCOLORS = [
'rgb(0,255,255)',
'rgb(255,0,255)',
'rgb(192,192,192)',
'rgb(128,0,0)',
'rgb(128,128,0)',
'rgb(128,0,128)',
'rgb(0,128,128)',
'rgb(0,0,128)'
];


// class to handle a y-axis of the scatter plot
export class ScatterYAxis {
  constructor(title, range, index) {
    this.title = title;
    this.range = range; 
    this.index = index;
  }

  trace_name() {
    var y_name = "y";
    if (this.index > 0) {
      y_name = y_name + String(this.index+1);
    }
    return y_name;
  }

  layout_name() {
    var y_name = "yaxis";
    if (this.index > 0) {
      y_name = y_name + String(this.index+1);
    }
    return y_name;
  }

  color() {
    return YCOLORS[this.index-1];
  }

  build() {
    var ret = {
      range: this.range,
      title: this.title,
      titlefont: {color: this.color()},
      tickfont: {color: this.color()},
    };
    if (this.index > 0) {
      ret.overlaying = "y";
      ret.side = "right";
      ret.showgrid = false;
    }
    if (this.index > 1) {
      ret.position = 1. - 0.15 * (this.index-1);
    }
    return ret;
  }

}

// class to handle a Data Trace
export class DataTrace {
  // takes handle to x and y data
  // and a title and handle to what y-axis it is on
  constructor(title, y_axis, data_handle, times_handle) {
    this.title = title;
    this.y_axis = y_axis;
    this.data_handle = data_handle;
    this.times_handle = times_handle;
  }

  trace() {
    var ret =  {
      y: this.data_handle,
      x: this.times_handle,
      type: 'scatter',
      name: this.title,
      yaxis: this.y_axis.trace_name()
    };
    if (this.y_axis.index > 0) {
      ret.marker = { color: YCOLORS[this.y_axis.index-1] };
    }
    return ret;
  }
}


