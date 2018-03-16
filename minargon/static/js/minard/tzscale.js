// requires d3.js, moment.js, and moment-timezone.js
// a d3.time.scale like object which returns ticks evenly spaced
// in a specific timezone

var tzscale = (function() {
    var units = ['millisecond', 'second', 'minute', 'hour', 'date', 'month', 'year'];

    var intervals = [
    [1,             [1,  'second']],
    [5,             [5,  'second']],
    [15,            [15, 'second']],
    [30,            [30, 'second']], // second
    [1*60,          [1,  'minute']],
    [5*60,          [5,  'minute']],
    [15*60,         [15, 'minute']],
    [30*60,         [30, 'minute']], // minute
    [1*60*60,       [1,  'hour']],
    [3*60*60,       [3,  'hour']],
    [6*60*60,       [6,  'hour']],
    [12*60*60,      [12, 'hour']], // hour
    [24*60*60,      [1,  'date']],
    [2*24*60*60,    [2,  'date']],
    [7*24*60*60,    [7,  'date']], // days and week
    [30*24*60*60,   [1,  'month']],
    [3*30*24*60*60, [3,  'month']] // month
    ]

    function get_step(start, stop, n) {
        // get the appropriate tick step length for an interval
        // starting at start and ending at stop
        // start and stop should be javascript Date objects
        var secs = (stop.getTime() - start.getTime())/1000; // seconds

        for (var i=0; i < intervals.length; i++) {
            if (secs/intervals[i][0] < n)
                return intervals[i][1];
        }

        return [1, 'year']; // default to year
    }

    function round(date, n, unit) {
        // rounds a moment() object to the nearest
        // time which is a multiple of n units
        // e.x. round(date,1,'minute') will round
        // the date up to the next minute
        var add = n - (date[unit]() % n);

        var result = date.clone();
        for (var i=0; i < units.length; i++) {
            if (units[i] == unit)
                 break;

            if (units[i] == 'date') {
                result.date(1);
            } else {
                result[units[i]](0); // zero smaller units
            }
        }

        return result.add(add,unit === 'date' ? 'days' : unit);
    }

    function tzscale(zone) {
        // d3.time.scale like object which returns ticks
        // spaced nicely in a given timezone.
        // zone should be a string which can be passed
        // to moment.tz. See http://momentjs.com/timezone/docs/#/using-timezones/.
        var _scale = d3.time.scale();

        function scale(x) {
            return _scale(x);
        }

        scale.ticks = function(count) {
            count = typeof count !== 'undefined' ? count : 10;

            var start = scale.domain()[0];
            var stop = scale.domain()[1];
            var step = get_step(start, stop, count);

            var ticks = [round(moment.tz(start, zone), step[0], step[1])];
            while (ticks[ticks.length-1].isBefore(stop)) {
                if (ticks.length > count*2) break;
                ticks.push(ticks[ticks.length-1].clone().add(step[0],step[1] === 'date' ? 'days' : step[1]));
            }

            return ticks.map(function(date) { return date.toDate(); });
        }

        scale.tickFormat = function(count) {
            function format(date) {
                date = moment.tz(date, zone);

                // taken from https://github.com/mbostock/d3/wiki/Time-Scales#tickFormat
                if (date.milliseconds()) {
                    return date.format('.SSS');
                } else if (date.seconds()) {
                    return date.format(':ss');
                } else if (date.minutes()) {
                    return date.format('hh:mm');
                } else if (date.hours()) {
                    return date.format('hh A');
                } else if (date.day() && date.date() != 1) {
                    return date.format('ddd DD');
                } else if (date.date() != 1) {
                    return date.format('MMM DD');
                } else if (date.month()) {
                    return date.format('MMMM');
                } else {
                    return date.format('YYYY')
                }
            }

            return format;
        }

        scale.zone = function(value) {
            if (!arguments.length)
                return zone;
            zone = value;
            return scale;
        }

        scale.copy = function() {
            return tzscale().zone(zone).range(scale.range()).domain(scale.domain());
        }

        return d3.rebind(scale, _scale, 'invert', 'domain', 'nice', 'range', 'rangeRound', 'interpolate', 'clamp');
    }

    return tzscale;
}());

