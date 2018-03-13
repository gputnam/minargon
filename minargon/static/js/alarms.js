setInterval(function() { $('#time').text(moment().tz('America/Toronto').format('HH:mm:ss')); }, 1000);

// checkboxes are checked by default
$('input[name="view"]').prop('checked',true);
// show/hide labels when checked/unchecked
$('input[name="view"]').click(function() {
    if ($(this).is(':checked')) {
        $('p span.label-' + $(this).val()).parent().show();
    } else {
        $('p span.label-' + $(this).val()).parent().hide();
    }
});

var _last_date = null;

function update_alarms(start)
{
    if (typeof(start) === 'undefined') start = -100;

    $.getJSON($SCRIPT_ROOT + '/get_alarm?start=' + start).done(function(obj) {
        for (var i=0; i < obj.alarms.length; i++) {
            obj.alarms[i].time = moment.tz(obj.alarms[i].time, 'America/Toronto');
        }
        _last_date = log.log('#log', obj.alarms, _last_date);
        $("#log p").slice(1000).remove();
        setTimeout(function() { update_alarms(obj.latest+1); },1000); // 1 second
    });
}
