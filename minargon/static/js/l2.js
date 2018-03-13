function update_files(name, interval) {
    // update the list of files in the l2 state `name`

    $.getJSON($SCRIPT_ROOT + '/get_l2?name=' + name).done(function(obj) {
        $('#' + name + ' tbody tr').remove();
        for (var i=0; i < obj.files.length; i++) {
            var mom = moment.tz(Number(obj.times[i])*1000, "America/Toronto");
            var tr = $('<tr>')
                .append($('<td>').text(obj.files[i]))
                .append($('<td>').text(mom.fromNow()));
            $('#' + name).find('tbody').append(tr);
        }
        setTimeout(function() {update_files(name, interval); }, interval*1000);
    });
}

$("#step-menu").on("change", function() {
    window.location.replace($SCRIPT_ROOT + "/l2?step=" + this.value + "&height=" + url_params.height);
});

var context = create_context('#main', url_params.step);

var TRIGGER_NAMES = ['TOTAL','100L','100M','100H','20','20LB','ESUML','ESUMH',
  'OWLN','OWLEL','OWLEH','PULGT','PRESCL', 'PED','PONG','SYNC','EXTA',
  //'EXT2','EXT3','EXT4','EXT5','EXT6','EXT7', 'EXT8','SRAW','NCD', 'SOFGT','MISS'
  ];

var L2_STREAMS = ['L1','L2','ORPHANS','BURSTS'];

function metric(name) {
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
    }, name);
}

function add_horizon(expressions, format, colors, extent) {
    var horizon = context.horizon().height(Number(url_params.height));

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

add_horizon(["TOTAL"],format_rate);
add_horizon(L2_STREAMS,format_rate);
add_horizon(["L2:gtid"],format_int,[]);

var horizon = context.horizon()
    .height(Number(url_params.height))
    .extent([-60,60]);

d3.select('#main').selectAll('.horizon')
    .data([(metric('gtid').subtract(metric('L2:gtid'))).divide(metric('TOTAL'))],String)
  .enter().insert('div','.bottom')
    .attr('class', 'horizon')
    .call(horizon);

add_horizon(["L2:run"],format_int,[]);

context.on("focus", function(i) {
  d3.selectAll(".value").style("right", i === null ? null : context.size() - i + "px");
});
