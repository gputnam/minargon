
function create_context(target, step) {
    var scale = tzscale().zone('America/Toronto');

    var size = $(target).width();
    var context = cubism.context(scale)
        .serverDelay(1e3)
        .clientDelay(1e3)
        .step(step*1000)
        .size(size);

    function format_seconds(date) {
        return moment.tz(date, 'America/Toronto').format('hh:mm:ss');
    }

    function format_minutes(date) {
        return moment.tz(date, 'America/Toronto').format('hh:mm');
    }

    function format_day_hour(date) {
        return moment.tz(date, 'America/Toronto').format('MMM DD, hh A');
    }

    function format_day(date) {
        return moment.tz(date, 'America/Toronto').format('MMMM DD');
    }

    if (step < 30) {
        focus_format = format_seconds;
    } else if (step < 30*60) {
        focus_format = format_minutes;
    } else if (step < 12*60*60) {
        focus_format = format_day_hour;
    } else {
        focus_format = format_day;
    }

    // delete old axes
    $(target + ' .axis').remove();

    // add time axes
    d3.select(target).selectAll(".axis")
        .data(["top", "bottom"])
      .enter().append("div")
        .attr("class", function(d) { return d + " axis"; })
        .each(function(d) {
            var axis = context.axis()
                .ticks(12)
                .orient(d)
                .focusFormat(focus_format);
            d3.select(this).call(axis);
        });

    // delete old rule
    $(target + ' .rule').remove();

    d3.select(target).append("div")
        .attr("class", "rule")
        .call(context.rule());

    return context;
}

si_format = d3.format('.2s');
percentage_format = d3.format('.2%');
fixed_format = d3.format('.0f');
precision_format = d3.format('.2g');

function my_si_format(d) {
    if (!$.isNumeric(d))
        return '-';
    else
        return si_format(d);
}

function my_percentage_format(d) {
    if (!$.isNumeric(d))
        return '-';
    else
        return percentage_format(d);
}

function base_format(d) {
    if (!$.isNumeric(d))
        return '-';
    else
        return fixed_format(d);
}

var si_format = d3.format('.2s');

function format_rate(n) {
    if (!$.isNumeric(n)) {
        return '-';
    } else if (n > 100) {
        return si_format(n);
    } else if (n >= 0 && n % 1 === 0) {
        return n.toString();
    } else {
        return precision_format(n);
    }
}

function format_int(n) {
    if (!$.isNumeric(n)) {
        return '-';
    } else {
        return n.toString();
    }
}

function format(str) {
    var fmt = d3.format(str);

    return function(n) { return (!$.isNumeric(n)) ? '-' : fmt(n); };
}

