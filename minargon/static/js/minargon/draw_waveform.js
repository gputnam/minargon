// requires d3 and plotly loaded

function draw_waveform(target, param) {
  d3.json($SCRIPT_ROOT + "/snapshot/waveform?" + $.param(param), function(err, data) {
    if (data == null || data.value == null) return;
    var waveform = data.value;

    var xrange = Array.apply(null, Array(waveform.length)).map(function (_, i) {return i;});

    var trace = {
      x: xrange,
      y: waveform,
      type: 'scatter'
    };

    var layout = {
      xaxis: {
        title: "Time Step",
      },
      yaxis: {
        title: "ADC Count",
      },
    };

    Plotly.newPlot(target, [trace], layout)
  });
}


function draw_fft(target, param) {
  d3.json($SCRIPT_ROOT + "/snapshot/fft?" + $.param(param), function(err, data) {
    if (data == null || data.value == null) return;
    var fft_vals = data.value;

    // ignore the first element of the fft, corresponding to the baseline
    var xrange = Array.apply(null, Array(fft_vals.length - 1)).map(function (_, i) {return i;});

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
        title: "ADC frequency",
      },
      yaxis: {
        title: "Transformed ADC Count (Non-Normalized)",
      },
    };

    Plotly.newPlot(target, [trace], layout)
  });
}


