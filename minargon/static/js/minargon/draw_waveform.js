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
