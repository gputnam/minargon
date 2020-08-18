// All code here relies on plotly.js being loaded
// TODO: make use of module imports

// class managing a plotly scatter plot
export class CorrelationScatter {

    constructor(target, title, xname, yname) {
      this.target = target;

      this.correlation_data_x = [];
      this.times_x = [];

      this.correlation_data_y = [];
      this.times_y = [];
      this.text = [];

      this.trace = [
        {
          type: 'scatter',
          x: this.correlation_data_x,
          y: this.correlation_data_y,
          text: this.text,
          mode: 'markers',
        }
      ];

      this.is_drawn = false;

      this._title = title;
      this._xname = xname;
      this._yname = yname;
    }

    textformat(x, y, time_x, time_y) {
      return this._xname +
             ' at: ' + time_x + '<br>' +
             this._yname +
             ' at: ' + time_y;
    }

    set title(title) {
      this._title = title;
      if (this.is_drawn) {
        var layout = {};
        layout["name"] = this._title;
        Pltoly.relayout(this.target, layout);
      }
    }

    draw() {
      var layout = this.build_layout();
      this.is_drawn = true;

      Plotly.newPlot(this.target, this.trace, layout);
    }

    // update the data and redraw the plot
    // data should be a single time stream
    updateData(buffer) {
      var buffer_x = buffer[0];
      var buffer_y = buffer[1];

      // delete the old data
      this.correlation_data_x.length = 0;
      this.correlation_data_y.length = 0;
      this.times_x.length = 0;
      this.times_y.length = 0;
      this.text.length = 0;

      var data_x = [];
      var times_x = [];
      var timestamps_x = [];
      var step_x = 0;

      for (var j = 0; j < buffer_x.size; j++) {
        var dat = buffer_x.get(j);
        timestamps_x[j] = Math.round(dat[0] / 1000);
        times_x[j] =  moment.unix(Math.round(dat[0] / 1000))
            .tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
        data_x[j] = dat[1];

        if (j > 0) {
          step_x = ((j-1) * step_x + timestamps_x[j] - timestamps_x[j-1]) / j
        }
      }

      var data_y = [];
      var times_y = [];
      var timestamps_y = [];
      var step_y = 0;

      for (var j = 0; j < buffer_y.size; j++) {
        var dat = buffer_y.get(j);
        timestamps_y[j] = Math.round(dat[0] / 1000);
        times_y[j] =  moment.unix(Math.round(dat[0] / 1000))
            .tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
        data_y[j] = dat[1];

        if (j > 0) {
          step_y = ((j-1) * step_y + timestamps_y[j] - timestamps_y[j-1]) / j
        }
      }


      // use the stream with the larger step as the base
      if (step_x > step_y) {
        var base_data = data_x;
        var base_timestamps = timestamps_x;
        var base_times = times_x;

        var other_data = data_y;
        var other_timestamps = timestamps_y;
        var other_times = times_y;

        var base_is_x = true;
        var step = step_y;
        
      }
      else {
        var base_data = data_y;
        var base_timestamps = timestamps_y;
        var base_times = times_y;

        var other_data = data_x;
        var other_timestamps = timestamps_x;
        var other_times = times_x;

        var base_is_x = false;
        var step = step_x;
      }

      var j = 0;
      for (var i = 0; i < base_data.length; i++) {
        while (j < other_data.length && other_timestamps[j] + step < base_timestamps[i]) j++;
        if (j == other_data.length) break;

        if (base_timestamps[i] + step < other_timestamps[j]) continue;

        // find the closest time within the reslution
        var min_j = j;
        while (j < other_data.length && Math.abs(other_timestamps[j] - base_timestamps[i]) < step) j++;
        var max_j = j;

        var closest_time = step * 10;
        var closest_j = 0;
        for (var ind = min_j; ind <= max_j; ind++) {
          if (Math.abs(other_timestamps[ind] - base_timestamps[i]) < closest_time) {
            closest_time = Math.abs(other_timestamps[ind] - base_timestamps[i]);
            closest_j = ind;
          }
        }

        // we got a new data point!
        if (base_is_x) {
          this.correlation_data_x.push(base_data[i]); 
          this.times_x.push(base_times[i]);
          this.correlation_data_y.push(other_data[closest_j]);
          this.times_y.push(other_times[closest_j]);
        }
        else {
          this.correlation_data_y.push(base_data[i]); 
          this.times_y.push(base_times[i]);
          this.correlation_data_x.push(other_data[closest_j]);
          this.times_x.push(other_times[closest_j]);
        }
        
 
        j = closest_j + 1;
        
      }

      // now update the hover labels
      for (var i = 0; i < this.correlation_data_x.length; i++) {
        this.text.push(this.textformat(this.correlation_data_x[i], this.correlation_data_y[i], this.times_x[i], this.times_y[i]));
      }

      this.redraw();
    }

    redraw() {
      Plotly.redraw(this.target);
    }

    build_layout() {
      // build the layout for this plot
      var layout = {
        hoverlabel: {
          align: "right"
        },
        hovermode: "closest"
      };

      layout["name"] = this._title;
      layout["xaxis"] = {
        title: this._xname
      };
      layout["yaxis"] = {
        title: this._yname
      };

      return layout;
    }
}
