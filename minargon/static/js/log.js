(function(log, $, undefined) {

    var level_name_to_level = {
        'SUCCESS' : 21,
        'INFO'    : 20,
        'WARNING' : 30,
        'ERROR'   : 40,
        'DEBUG'   : 10,
    };

    var level_to_value = {
        '-1' : 'unknown',
        21 : 'success',
        20 : 'info',
        30 : 'warning',
        40 : 'danger',
        10 : 'debug',
    };

    var level_to_label = {
        '-1' : '<span class="label label-default label-unknown label-block">???</span>',
        21 : '<span class="label label-success label-block">Success</span>',
        20 : '<span class="label label-info label-block">Info</span>',
        30 : '<span class="label label-warning label-block">Warning</span>',
        40 : '<span class="label label-danger label-block">Error</span>',
        10 : '<span class="label label-default label-debug label-block">Debug</span>',
    };

    function same_day(mom1, mom2) {
        // returns true if mom1 and mom2 are the same day
        return mom1.date() == mom2.date() && mom1.month() == mom2.month() && mom1.year() == mom2.year();
    }

    function get_value(value) {
        if (value in level_to_value) {
            return level_to_value[value];
        }

        return level_to_value[-1];
    }

    function get_level(name) {
        if (name in level_name_to_level) {
            return level_name_to_level[name];
        }

        return -1;
    }

    function get_label(level) {
        if (level in level_to_label) {
            return level_to_label[level];
        }

        // unknown level
        return level_to_label[-1];
    }

    function parse_line(line) {
        var toks = line.split(' - ');

        var mom = moment(toks[0], 'YYYY-MM-DD hh:mm:ss,SSS', true);

        if (!mom.isValid()) {
            return {time: mom, message: line, level: -1}
        }

        var level = get_level($.trim(toks[2]));
        var message = toks.slice(3).join(' - ');

        return {time: mom, message: message, level: level}
    }

    function _log(selector, records, last_date) {
        var now = moment().tz('America/Toronto');

        for (var i=0; i < records.length; i++)
        {
            var record = records[i];

            if (!record.time.isValid()) {
                // print whole message
                $(selector).prepend('<p>' + level_to_label[-1] + ' ' + record.message);
                continue;
            }

            if (last_date === null)
            {
                last_date = record.time;
            } else
            {
                if (!same_day(record.time,last_date))
                {
                    $(selector).prepend('<div class="border-bottom text-center">' + last_date.format('MM/DD/YYYY') + '</div>');
                    last_date = record.time;
                }
            }

            var p = $('<p>')
                .append(get_label(record.level))
                .append(' ')
                .append(record.time.format('HH:mm:ss'))
                .append(' ')
                .append(record.message);

            var value = get_value(record.level);

            if (!$('input[name="view"][value="' + value + '"]').prop('checked')) {
                p.hide();
            }

            $(selector).prepend(p);

            if ((i == records.length-1) && !same_day(now,record.time))
            {
                $(selector).prepend('<div class="border-bottom text-center">' + record.time.format('MM/DD/YYYY') + '</div>');
                last_date = now;
            }
        }

        return last_date;
    }

    // log log log :)
    log.log = _log;

    log.parse_line = parse_line;

// see http://stackoverflow.com/questions/881515/how-do-i-declare-a-namespace-in-javascript
// for this design pattern
}(window.log = window.log || {}, jQuery));

