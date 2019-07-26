// requires d3 and plotly loaded
// TODO: use import modules

// Helper function for drawing a waveform from a snapshot as provided by the 
// raw data api from the Flask backend


// NOTE: the timing values are hardcoded from the SBND VST -- this may have to change in the future


// Draw a waveform in the specified target from the specified link
// target: div-id of the location of the plot
// param: dictionary where the key-value pairs will be GET params for the URL specified
//        to get data from the backend raw data API
export function draw_waveform(target, param) {
  d3.json($SCRIPT_ROOT + "/online/snapshot/waveform?" + $.param(param), function(err, data,i) {
    if (data == null || data.values == null) return;
var waveform = data.values;
//for (int i=0;i< 575;i++){

//}
//loop around all waveforms and include the channel number too
    var xrange = Array.apply(null, Array(waveform.length)).map(function (_, i) {return i * 0.4 /* scale to usec */;});;
//    std::cout << i<<std::endl;
      var trace{
      x: xrange,
      y: waveform,
      type: 'scatter'
    };

    var layout = {
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

// Draw an FFT in the specified target from the specified link
// target: div-id of the location of the plot
// param: dictionary where the key-value pairs will be GET params for the URL specified
//        to get data from the backend raw data API
export function draw_fft(target, param) {
  d3.json($SCRIPT_ROOT + "/online/snapshot/fft?" + $.param(param), function(err, data) {
    if (data == null || data.values == null) return;
    var fft_vals = data.values;
    if (!fft_vals.length) return;

    var khz_scaling_value = 1250./(fft_vals.length - 1); // max value in fft should be 1.25MHz

    // ignore the first element of the fft, corresponding to the baseline
    var xrange = Array.apply(null, Array(fft_vals.length - 1)).map(function (_, i) {return i * khz_scaling_value;});

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

    var layout = {
      xaxis: {
        title: "Frequency (KHz)",
      },
      yaxis: {
        title: "Transformed ADC Count (Non-Normalized)",
      },
    };

    Plotly.newPlot(target, [trace], layout)
  });
}


