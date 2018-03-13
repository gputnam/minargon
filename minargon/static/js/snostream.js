$("#step-menu").on("change", function() {
    window.location.replace($SCRIPT_ROOT + "/snostream?step=" + this.value + "&height=" + height);
});

setInterval(function() {
    $.getJSON($SCRIPT_ROOT + '/query', {'name': 'dispatcher'}, function(reply) {
        $('#dispatcher').text(reply.name);
    });
},1000);

var context = create_context('#main', step);

var TRIGGER_NAMES = ['TOTAL','100L','100M','100H','20','20LB',//'ESUML',
  'ESUMH',
  'OWLN', //'OWLEL',
  'OWLEH','PULGT','PRESCL', 'PED','PONG','SYNC','EXTA', 'EXT2',
  //'EXT3','EXT4','EXT5',
  'EXT6',
  //'EXT7', 'EXT8',
  //'SRAW','NCD',
  'SOFGT','MISS'
  ];

function metric(name) {
    var display = name;

    // display 20LB trigger as 20L
    if (name == "20LB") {
        display = "20L";
    } else if (name == "20LB-Baseline") {
        display = "20L-Baseline";
    } else if (name == "EXT6") {
        display = "NO CLOCK";
    }

    return context.metric(function(start, stop, step, callback) {
        d3.json($SCRIPT_ROOT + '/metric' + 
                '?expr=' + name +
                '&start=' + start.toISOString() +
                '&stop=' + stop.toISOString() +
                '&now=' + new Date().toISOString() +
                '&step=' + Math.floor(step/1000), function(data) {
                if (!data) return callback(new Error('unable to load data'));
                return callback(null,data.values);
        });
    }, display);
}

function add_horizon(expressions, format, colors, extent) {
    var horizon = context.horizon().height(Number(height));

    if (typeof format != "undefined") horizon = horizon.format(format);
    if (typeof colors != "undefined" && colors) horizon = horizon.colors(colors);
    if (typeof extent != "undefined") horizon = horizon.extent(extent);

    d3.select('#main').selectAll('.horizon')
        .data(expressions.map(metric), String)
      .enter().insert('div','.bottom')
        .attr('class', 'horizon')
        .call(horizon)
        .on('click', function(d, i) {
            var domain = context.scale.domain();
            var params = {
                name: expressions[i],
                start: domain[0].toISOString(),
                stop: domain[domain.length-1].toISOString(),
                step: Math.floor(context.step()/1000)
            };
            window.open($SCRIPT_ROOT + "/graph?" + $.param(params), '_self');
        });
}

function add_baseline_horizon(expressions, format, colors, extent, baseline, mv_per_nhit) {
    /* Just like add_horizon except we subtract off 1.8V from the metric. */
    var horizon = context.horizon().height(Number(height));

    if (typeof format != "undefined") horizon = horizon.format(format);
    if (typeof colors != "undefined" && colors) horizon = horizon.colors(colors);
    if (typeof extent != "undefined") horizon = horizon.extent(extent);

    d3.select('#main').selectAll('.horizon')
        .data(expressions.map(function(name) { return metric(name).subtract(baseline).divide(mv_per_nhit/1e3) }), String)
      .enter().insert('div','.bottom')
        .attr('class', 'horizon')
        .call(horizon)
        .on('click', function(d, i) {
            var domain = context.scale.domain();
            var params = {
                name: expressions[i],
                start: domain[0].toISOString(),
                stop: domain[domain.length-1].toISOString(),
                step: Math.floor(context.step()/1000)
            };
            window.open($SCRIPT_ROOT + "/graph?" + $.param(params), '_self');
        });
}

add_horizon(TRIGGER_NAMES,format_rate);
if (url_params.display == 'fecd') {
    add_horizon(TRIGGER_NAMES.slice(1,6).map(function(x) { return "FECD/" + x }),format_rate);
    add_horizon(["FECD/N16"],format_rate);
}
add_horizon(["0\u03bd\u03b2\u03b2"],format_rate);
add_horizon(["TOTAL-nhit","TOTAL-charge","PULGT-nhit","PULGT-charge","EXTA-nhit"], format('.2s'));
add_horizon(["DISPATCH_ORPHANS"],format_rate);
add_horizon(["gtid"],format_int,[]);
add_horizon(["run"],format_int,[]);
add_horizon(["subrun"],format_int,[],[0,100]);
add_horizon(["heartbeat"],format_int,null,[0,4]);
/* mv_per_nhit is calculated very roughly using the fact that at the CTC the
 * trigger signal is 38 mV/hit, and we measured the conversion between CTC
 * voltage drop and baseline correction voltage in this shift report:
 * http://snopl.us/shift/view/daf725f9b1014a17a1d22c14083f747c?index_start=245. */
add_baseline_horizon(["100L-Baseline"],format_rate,null,[-10,10], 1.53, 15.0);
add_baseline_horizon(["100M-Baseline"],format_rate,null,[-10,10], 1.795, 4.17);
add_baseline_horizon(["100H-Baseline"],format_rate,null,[-10,10], 1.837, 1.50);
add_baseline_horizon(["20LB-Baseline"],format_rate,null,[-10,10], 1.795, 15.0);
add_baseline_horizon(["20-Baseline"],format_rate,null,[-10,10], 1.83, 1.50);
/* for the esum triggers, we just divide by the baseline correction voltage to
 * CTC voltage conversion so that we display the CTC voltage shift. */
add_baseline_horizon(["ESUML-Baseline"],format_rate,null,[-100,100], 1.8275, 0.4);
add_baseline_horizon(["ESUMH-Baseline"],format_rate,null,[-100,100], 1.796, 0.4);
/* OWLN was never measured, so assume it's high gain. */
add_baseline_horizon(["OWLN-Baseline"],format_rate,null,[-10,10], 1.845, 15.0);
//add_baseline_horizon(["OWLEL-Baseline"],format_rate,null,[-0.1,0.1], 1.83, 0.4);
add_baseline_horizon(["OWLEH-Baseline"],format_rate,null,[-100,100], 1.852, 0.4);
context.on("focus", function(i) {
  d3.selectAll(".value").style("right", i === null ? null : context.size() - i + "px");
});
