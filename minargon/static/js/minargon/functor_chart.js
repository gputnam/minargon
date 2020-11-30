// All code here relies on plotly.js being loaded
// TODO: make use of module imports

// class managing a plotly scatter plot
export class FunctorScatter {

    constructor(target, title, name_A, name_B, func) {
      this.target = target;
      this.func = func;

      this.data_A = [];
      this.times_A = [];
      this.data_B = [];
      this.times_B = [];

      this.times = [];
      this.data = [];
      this.text = [];

      this.trace = [
        {
          type: 'scatter',
          x: this.times,
          y: this.data,
          text: this.text,
        }
      ];

      this.is_drawn = false;

      this._Aname = name_A;
      this._Bname = name_B;
      this._title = title;
    }

    textformat(A, B, time_A, time_B) {
      return this._Aname +
             ' (' + String(A) + ') at: ' + time_A + '<br>' +
             this._Bname +
             ' (' + String(B) + ') at: ' + time_B;
    }

    set yrange(yrange) {
      this._yrange = yrange;
      if (this.is_drawn) {
        var layout = {};
        layout["yaxis.range"] = this._yrange;
        Plotly.relayout(this.target, layout);
      }
    }

    set title(title) {
      this._title = title;
      if (this.is_drawn) {
        var layout = {};
        layout["yaxis.title"] = this._title;
        Plotly.relayout(this.target, layout);
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
      var buffer_A = buffer[0];
      var buffer_B = buffer[1];

      // delete the old data
      this.data_A.length = 0;
      this.data_B.length = 0;
      this.times_A.length = 0;
      this.times_B.length = 0;
      this.text.length = 0;

      var data_A = [];
      var times_A = [];
      var timestamps_A = [];
      var step_A = 0;

      for (var j = 0; j < buffer_A.size; j++) {
        var dat = buffer_A.get(j);
        timestamps_A[j] = Math.round(dat[0] / 1000);
        times_A[j] =  moment.unix(Math.round(dat[0] / 1000))
            .tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
        data_A[j] = dat[1];

        if (j > 0) {
          step_A = ((j-1) * step_A + timestamps_A[j] - timestamps_A[j-1]) / j
        }
      }

      var data_B = [];
      var times_B = [];
      var timestamps_B = [];
      var step_B = 0;

      for (var j = 0; j < buffer_B.size; j++) {
        var dat = buffer_B.get(j);
        timestamps_B[j] = Math.round(dat[0] / 1000);
        times_B[j] =  moment.unix(Math.round(dat[0] / 1000))
            .tz("America/Chicago").format("YYYY-MM-DD HH:mm:ss");
        data_B[j] = dat[1];

        if (j > 0) {
          step_B = ((j-1) * step_B + timestamps_B[j] - timestamps_B[j-1]) / j
        }
      }


      // use the stream with the larger step as the base
      if (step_A > step_B) {
        var base_data = data_A;
        var base_timestamps = timestamps_A;
        var base_times = times_A;

        var other_data = data_B;
        var other_timestamps = timestamps_B;
        var other_times = times_B;

        var base_is_A = true;
        var step = step_B;
        
      }
      else {
        var base_data = data_B;
        var base_timestamps = timestamps_B;
        var base_times = times_B;

        var other_data = data_A;
        var other_timestamps = timestamps_A;
        var other_times = times_A;

        var base_is_A = false;
        var step = step_A;
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
        if (base_is_A) {
          this.data_A.push(base_data[i]); 
          this.times_A.push(base_times[i]);
          this.data_B.push(other_data[closest_j]);
          this.times_B.push(other_times[closest_j]);
        }
        else {
          this.data_B.push(base_data[i]); 
          this.times_B.push(base_times[i]);
          this.data_A.push(other_data[closest_j]);
          this.times_A.push(other_times[closest_j]);
        }
        
 
        j = closest_j + 1;
        
      }

      // now map the A/B data together
      this.data.length = 0;
      this.times.length = 0;
      for (var i = 0; i < this.data_A.length; i++) {
        this.data.push(this.func(this.data_A[i], this.data_B[i]));
        this.times.push(this.times_A[i]);
      }

      // now update the hover labels
      for (var i = 0; i < this.data_A.length; i++) {
        this.text.push(this.textformat(this.data_A[i], this.data_B[i], this.times_A[i], this.times_B[i]));
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
        title: "Time (CST/GMT-6)"
      };
      layout["yaxis"] = {
        title: this._title
      };
      if (this._yrange) {
        layout["yaxis.range"] = this._yrange;
      }

      return layout;
    }
}
