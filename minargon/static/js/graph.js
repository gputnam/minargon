function isNumber(x)
{
    return !isNaN(x) && (x != null);
}

function format_data(values, start, stop, step)
{
    var data = new Array();
    for (var i=0; i < values.length; i++)
    {
        var date = moment(start);
        date.add(step*i, 'seconds');
        data.push({'date': date.toDate(), 'value': values[i]});
    }
    return data;
}

function add_graph(name, start, stop, step)
{
    d3.json($SCRIPT_ROOT + '/metric' + 
            '?expr=' + name +
            '&start=' + start.toISOString() +
            '&stop=' + stop.toISOString() +
            '&now=' + new Date().toISOString() +
            '&step=' + Math.floor(step),
            function(data) {
                if (!data) console.log('unable to load data');

                var values = data.values;
                if (Array.isArray(values[0])) {
                    var chart_data = values.map(function(x) { return format_data(x,start,stop,step)});
                    var dates = chart_data[0].map(function(d) { return d['date']; });
                    var scale = tzscale().domain(dates).zone('America/Toronto');

                    var valid = values[0].filter(isNumber);
                } else {
                    var chart_data = format_data(values,start,stop,step);
                    var dates = chart_data.map(function(d) { return d['date']; });
                    var scale = tzscale().domain(dates).zone('America/Toronto');

                    var valid = values.filter(isNumber);
                }

		var time_fmt = 'MMM Do YYYY';

		if (step < 1) {
		    time_fmt = 'ddd MMM Do YYYY, h:mm:ss.SSS a';
		} else if (step < 60) {
		    time_fmt = 'ddd MMM Do YYYY, h:mm:ss a';
		} else if (step < 3600) {
		    time_fmt = 'ddd MMM Do YYYY, h:mm a';
		} else if (step < 24*3600) {
		    time_fmt = 'ddd MMM Do YYYY, h a';
		}

                var params = {
                    title: name,
                    chart_type: valid.length ? 'line' : 'missing-data',
                    area: false,
                    data: chart_data,
                    interpolate: 'linear',
                    width: $('#main').width(),
                    height: url_params['height'] || 250,
                    show_secondary_x_label: false,
                    //xax_tick: 0,
		    time_scale: scale,
                    xax_format: scale.tickFormat(data.length),
                    y_extended_ticks: true,
                    target: "#main",
                    x_accessor:'date',
                    y_accessor:'value',
		    min_y_from_data: true,
		    x_mouseover: function(d, i) {
			return moment.tz(d['date'] || d['key'], 'America/Toronto').format(time_fmt) + '  ';
		    },
                };

                if (Array.isArray(values[0])) {
                    params.legend = name.split(",");
                    params.right = 100;
                }

                MG.data_graphic(params);

                if (!Array.isArray(values[0])) {
                    var width = $('#hist').width();

                    MG.data_graphic({
                        data: valid,
                        chart_type: valid.length ? 'histogram' : 'missing-data',
                        width: width,
                        height: width/1.6,
                        bins: 50,
                        bar_margin: 1,
                        target: '#hist',
                    });

                    // log
                    MG.data_graphic({
                        data: valid,
                        y_scale_type: 'log',
                        chart_type: valid.length ? 'histogram' : 'missing-data',
                        width: width,
                        height: width/1.6,
                        bins: 50,
                        bar_margin: 1,
                        target: '#hist-log',
                    });
                }
            });
}
