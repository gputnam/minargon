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

function update_log(name, seek) {
    if (typeof(seek) === 'undefined') seek = null;

    $.getJSON($SCRIPT_ROOT + '/tail?name=' + name + '&seek=' + seek).done(function(obj) {
        records = obj.lines.map(log.parse_line);
        _last_date = log.log('#log', records, _last_date);
        $("#log p").slice(1000).remove();
        setTimeout(function() { update_log(name, obj.seek); },1000); // 1 second
    });
}
