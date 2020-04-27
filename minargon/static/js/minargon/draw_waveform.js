// requires d3 and plotly loaded
// TODO: use import modules
import {throw_database_error} from "./error.js";

// Helper function for drawing a waveform from a snapshot as provided by the 
// raw data api from the Flask backend


// NOTE: the timing values are hardcoded from the SBND VST -- this may have to change in the future

function get_meta(keyname, param, callback) {
  // build the URL
  var url = $SCRIPT_ROOT + "/online/hget/snapshot:" + keyname;
  for (var key in param) {
    url += ":" + key + ":" + param[key];
  }
  url += "/"
  var dictkeys = ["run", "subrun", "event", "time"];
  for (var i = 0; i < dictkeys.length; i++) {
    url += dictkeys[i] + ","
  }
  d3.json(url, function(err, data) {
    if (!data) {
      throw_database_error(err, "get_meta:" + keyname);
      return;
    }
    return callback(data);
  });

}

// Draw a waveform in the specified target from the specified link
// target: div-id of the location of the plot
// param: dictionary where the key-value pairs will be GET params for the URL specified
//        to get data from the backend raw data API
export function draw_waveform(target, param, keyname, name) {
  function do_draw(metadata) {
  d3.json($SCRIPT_ROOT + "/online/waveform/" + keyname + "?" + $.param(param), function(err, data) {
    if (!data) {
      throw_database_error(err, "draw_waveform");
      return;
    }

    if (data == null || data.data == null || data.offsets == null || data.period == null) return;
    var waveform = data.data;
    var offsets = data.offsets;
    var period = data.period;
    if (!waveform.length || !waveform[0].length) return;

    var xrange = [];
    var yrange = [];
    for (var i = 0; i < waveform.length; i++) {
      for (var j = 0; j < waveform[i].length; j++) {
        xrange.push(offsets[i] + j * period);
        yrange.push(waveform[i][j]);
      }
    }

    var trace = {
      x: xrange,
      y: yrange,
      type: 'scatter'
    };

    var date = new Date(parseInt(metadata.time));
    var pretty_time = date.toLocaleDateString() + " " + date.toLocaleTimeString();
    var title = name + " Channel " + param["wire"] + " from Run (" + metadata.run + ") SubRun (" + metadata.subrun + ") Event (" + metadata.event + ") At: " + pretty_time + " (CST/GMT-6)";

    var layout = {
      title: title,
      xaxis: {
        title: "Time (usec)",
      },
      yaxis: {
        title: "ADC Count",
      },
    };

    Plotly.newPlot(target, [trace], layout)
  });
  }
  get_meta(keyname, param, do_draw); 
}

// Draw an FFT in the specified target from the specified link
// target: div-id of the location of the plot
// param: dictionary where the key-value pairs will be GET params for the URL specified
//        to get data from the backend raw data API
export function draw_fft(target, param, keyname, name) {
  function do_draw(metadata) {
  d3.json($SCRIPT_ROOT + "/online/waveform/" + keyname + "?" + $.param(param), function(err, data) {
    if (!data) {
      throw_database_error(err, "draw_fft");
      return;
    }

    if (data == null || data.data == null || data.period == null) return;
    var fft_vals = data.data[0];
    if (!fft_vals.length) return;

    // get the xrange from the "tick period" -- which should be in units of frequency
    var mhz_scaling_value = (data.period*2) / fft_vals.length;

    // ignore the first element of the fft, corresponding to the baseline
    var xrange = Array.apply(null, Array(fft_vals.length - 1)).map(function (_, i) {return (i+1) * mhz_scaling_value;});

    // and scale the fft by its length
    // (version stored in redis is an unnormalized one, as calculated by fftw3)
    // var fft = fft_vals.slice(1, -1).map( (dat) => dat / fft_vals.length);

    // don't normalize for now
    var fft = fft_vals.slice(1, -1);

    var trace = {
      x: xrange,
      y: fft,
      type: 'scatter'
    };

    var date = new Date(parseInt(metadata.time));
    var pretty_time = date.toLocaleDateString() + " " + date.toLocaleTimeString();
    var title = name + " Channel " + param["wire"] + " from Run (" + metadata.run + ") SubRun (" + metadata.subrun + ") Event (" + metadata.event + ") At: " + pretty_time + " (CST/GMT-6)";

    var layout = {
      title: title,
      xaxis: {
        title: "Frequency (MHz)",
      },
      yaxis: {
        title: "Transformed ADC Count (Non-Normalized)",
      },
    };

    Plotly.newPlot(target, [trace], layout)
  });
  }
  get_meta(keyname, param, do_draw); 
}


