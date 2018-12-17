// requires d3 and plotly loaded

function draw_waveform(target, param) {
  d3.json($SCRIPT_ROOT + "/online/snapshot/waveform?" + $.param(param), function(err, data) {
    if (data == null || data.value == null) return;
    var waveform = data.value;

    var xrange = Array.apply(null, Array(waveform.length)).map(function (_, i) {return i * 0.5 /* scale to usec */;});

    var trace = {
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


function draw_fft(target, param) {
  d3.json($SCRIPT_ROOT + "/online/snapshot/fft?" + $.param(param), function(err, data) {
    if (data == null || data.value == null) return;
    var fft_vals = data.value;
    if (!fft_vals.length) return;

    var khz_scaling_value = 1000./(fft_vals.length - 1); // max value in fft should be 1MHz

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


