var STEP, SOURCE, METHOD, SCALE, CRATE_WINDOW;

function metric(timeseries, crate, card, channel) {
    var label;
    if (card === null)
        label = 'crate ' + crate;
    else if (channel === null)
        label = 'card ' + card;
    else
        label = 'channel ' + channel;

    return timeseries.context.metric(function(start, stop, step, callback) {
        var params = {
            name: SOURCE,
            start: start.toISOString(),
            stop: stop.toISOString(),
            now: new Date().toISOString(),
            step: Math.floor(step/1000),
            crate: crate,
            card: card,
            channel: channel,
            method: METHOD
        };

        d3.json($SCRIPT_ROOT + '/metric_hash?' + $.param(params),
            function(data) {
                if (!data)
                    return callback(new Error('unable to load data'));

                return callback(null,data.values);
            }
        );
    }, label);
}

function draw(timeseries) {
    // create a horizon from timeseries.context and draw horizons
    if (timeseries.horizon) {
        d3.select(timeseries.target).selectAll('.horizon')
        .call(timeseries.horizon.remove)
        .remove();
    }

    timeseries.horizon = timeseries.context.horizon()
        .height(20)
        .colors(SCALE.range().concat(SCALE.range()))
        .extent(SCALE.domain())
        .format(timeseries.format);

    var horizons = d3.select(timeseries.target).selectAll('.horizon')
        .data(timeseries.metrics)
      .enter().insert('div','.bottom')
          .attr('class', 'horizon')
          .call(timeseries.horizon);

    if (timeseries.click)
        horizons.on('click', timeseries.click);
}

function update_metrics(timeseries) {
    if (timeseries.context !== null)
        timeseries.context.stop();

    timeseries.context = create_context(timeseries.target, STEP);
    timeseries.metrics = [];

    if (typeof timeseries.crate === 'undefined') {
        timeseries.metrics[0] = timeseries.context.metric(function(start, stop, step, callback) {
            var params = {
                name: SOURCE,
                start: start.toISOString(),
                stop: stop.toISOString(),
                now: new Date().toISOString(),
                step: Math.floor(step/1000),
                method: METHOD
            };

            d3.json($SCRIPT_ROOT + '/owl_tubes?' + $.param(params),
                function(data) {
                    if (!data)
                        return callback(new Error('unable to load data'));

                    return callback(null,data.values);
                }
            );
        }, 'UFOWL');

        for (var i=0; i < 20; i++) {
            timeseries.metrics[i+1] = metric(timeseries, i, null, null);
        }

    } else if (typeof timeseries.card === 'undefined') {
        for (var i=0; i < 16; i++) {
            timeseries.metrics[i] = metric(timeseries, timeseries.crate, i, null);
        }
    } else {
        for (var i=0; i < 32; i++) {
            timeseries.metrics[i] = metric(timeseries, timeseries.crate, timeseries.card, i);
        }
    }
}

var default_thresholds = {
    cmos: [100,5e3],
    base: [10, 80],
    occupancy: [0.001, 0.005]
};

function set_thresholds(lo, hi) {
    // set thresholds text area
    $('#threshold-lo').val(lo);
    $('#threshold-hi').val(hi);
}

function switch_to_crate(crate) {
    card.crate(crate);
    d3.select('#card').call(card);
    $('#card-7').after('<tr></tr>');
    $('#card-15').after('<tr></tr>');
    $('#card-23').after('<tr></tr>');

    blah.crate = crate;
    blah.state = NEEDS_UPDATE;
    channelts.crate = crate;
    channelts.state = NEEDS_UPDATE;

    $('.carousel').carousel('next');
}

function switch_to_channel(crate, card) {
    channelts.crate = crate;
    channelts.card = card;
    channelts.state = NEEDS_UPDATE;
    $('#carousel').carousel('next');
}

var ACTIVE = 0,
    PAUSED = 1,
    NEEDS_UPDATE = 2;

var spam = {
target: '#timeseries',
context: null,
horizon: null,
metrics:null,
format: my_si_format,
click: function(d, i) {
    if ((i > 0) && (i <= 20))
        switch_to_crate(i-1);
    },
state: NEEDS_UPDATE,
slide: 0
};
    
var blah = {
target: '#timeseries-card',
context: null,
horizon: null,
metrics:null,
format: my_si_format,
crate: 0,
click: function(d, i) {
    switch_to_channel(blah.crate, i);
    },
state: NEEDS_UPDATE,
slide: 1
};
    
var channelts = {
target: '#timeseries-channel',
context: null,
horizon: null,
metrics:null,
format: my_si_format,
crate: 0,
card: 0,
state: NEEDS_UPDATE,
slide: 2
};

function setup() {
    SOURCE = $('#data-source').val();
    METHOD = $('#data-method').val();
    STEP = +$('#data-step').val();
    CRATE_WINDOW = +$('#crate-map-window').val();

    var thresholds = default_thresholds[SOURCE];

    SCALE = d3.scale.threshold()
        .domain(thresholds)
        .range(colorbrewer[$("#colors").val()][3]);

    card = card_view()
        .scale(SCALE);

    crate = crate_view()
        .scale(SCALE)
        .click(function(d, i) {
            switch_to_crate(i);
        });

    update_format();
    update_metrics(spam);
    draw(spam);
    spam.state = ACTIVE;

    // set default thresholds in text area
    $('#threshold-lo').val(thresholds[0]);
    $('#threshold-hi').val(thresholds[1]);

}

function update_format() {
    if (SOURCE == 'cmos') {
        card.format(my_si_format);
    } else if (SOURCE == "occupancy") {
        card.format(d3.format('.0e'));
    } else {
        card.format(base_format);
    }

    timeseries.forEach(function(ts) {
        if (SOURCE == 'cmos') {
            ts.format = my_si_format;
        } else if (SOURCE == 'occupancy') {
            ts.format = my_percentage_format;
        } else {
            ts.format = base_format;
        }
    });
}

var timeseries = [spam, blah, channelts];

setup();

function update_state(call_update_metric) {
    call_update_metric = typeof call_update_metric === 'undefined' ? true : false;

    timeseries.forEach(function(ts) {
        switch (ts.state) {
            case ACTIVE:
                if (call_update_metric)
                    update_metrics(ts);
                draw(ts);
                break;
            case PAUSED:
                if (call_update_metric)
                    ts.state = NEEDS_UPDATE;
                else
                    draw(ts);
        }
    });
}

$('#data-method').change(function() {
    METHOD = this.value;

    update_state();
});

$('#colors').change(function() {
    SCALE.range(colorbrewer[this.value][3]);
    update_format();
    update();
    update_state();
});

$('#crate-map-window').change(function() {
    CRATE_WINDOW = this.value;

    update();
});

$('#data-step').change(function() {
    STEP = this.value;

    update_state();
});

$('#data-source').change(function() {
    // update threshold values
    var thresholds = default_thresholds[this.value];
    set_thresholds.apply(this,thresholds);

    SOURCE = this.value;
    SCALE.domain(thresholds);
    update_format();

    update();

    update_state();
});

$('#threshold-lo').keypress(function(e) {
    if (e.which == 13) {
        SCALE.domain([this.value,SCALE.domain()[1]]);

        update_state(false);

        d3.select("#crate").call(crate);
        d3.select("#card").call(card);
    }
});

$('#threshold-hi').keypress(function(e) {
    if (e.which == 13) {
        SCALE.domain([SCALE.domain()[0],this.value]);

        update_state(false);

        d3.select("#crate").call(crate);
        d3.select("#card").call(card);
    }
});

$('.carousel').on('slid.bs.carousel', function(e) {
    var slide = $(e.relatedTarget).index();
    $('#card-heading').text('Crate ' + blah.crate);
    $('#channel-heading').text('Crate ' + channelts.crate + ', Card ' + channelts.card);
    $('.data-source-heading').text($('#data-source :selected').text());

    timeseries.forEach(function(ts) {
        if (ts.slide == slide) {
            if (ts.state == NEEDS_UPDATE) {
                update_metrics(ts);
                draw(ts);
                ts.state = ACTIVE;
            } else if (ts.state == PAUSED) {
                ts.context.start();
                ts.state = ACTIVE;
            } else {
                console.log('timeseries already active');
            }
        } else {
            if (ts.state == ACTIVE) {
                ts.context.stop();
                ts.state = PAUSED;
            }
        }
    });
});

var interval = 5000;

function update() {
    $.getJSON($SCRIPT_ROOT + '/query', {name: SOURCE, step: CRATE_WINDOW})
        .done(function(result) {
            d3.select('#crate').datum(result.values).call(crate);
            d3.select('#card').datum(result.values).call(card);
        });
}

d3.select('#crate').datum([]).call(crate);
d3.select('#card').datum([]).call(card);
// wrap first ten and last ten crates in a div
$('#crate' + [0,1,2,3,4,5,6,7,8,9].join(',#crate')).wrapAll('<div />');
$('#crate' + [0,1,2,3,4].join(',#crate')).wrapAll('<div style="display:inline-block" />');
$('#crate' + [5,6,7,8,9].join(',#crate')).wrapAll('<div style="display:inline-block" />');
$('#crate' + [10,11,12,13,14,15,16,17,18,19].join(',#crate')).wrapAll('<div />');
$('#crate' + [10,11,12,13,14].join(',#crate')).wrapAll('<div style="display:inline-block" />');
$('#crate' + [15,16,17,18,19].join(',#crate')).wrapAll('<div style="display:inline-block" />');
update();
setInterval(update,interval);
