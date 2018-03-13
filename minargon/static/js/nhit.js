var chart = histogram()
    .xlabel('NHit')
    .margin({'left': 50})
    .bins(100)
    .min_bin_width(1);

var chart_log = histogram()
    .xlabel('NHit')
    .margin({'left': 50})
    .bins(100)
    .min_bin_width(1)
    .log(true);

function update_chart(selector, seconds, update) {
    $.getJSON($SCRIPT_ROOT + '/query', {'name': 'nhit:' + url_params.name, 'seconds': seconds}, function(reply) {
        d3.select(selector).datum(reply.value).call(chart);
        d3.select(selector + '-log').datum(reply.value).call(chart_log);
    });
    setTimeout(function() { update_chart(selector, seconds, update); }, update*1000);
}
