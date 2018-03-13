var ALARM_AUDIO = '<audio autoplay loop>' + 
'<source src="' + $SCRIPT_ROOT + '/static/audio/0096.ogg", type="audio/ogg">' +
'<source src="' + $SCRIPT_ROOT + '/static/audio/0096.mp3", type="audio/mpeg">' +
'<source src="' + $SCRIPT_ROOT + '/static/audio/0096.wav", type="audio/wav">' +
'</audio>';

// convert alarm level -> string
var alarm_level_map = {21: 'success', 20: 'info', 30: 'warning', 40: 'error'};

function update_toastr(latest) {
    next = latest + 1;
    $.getJSON($SCRIPT_ROOT + '/get_alarm?start=' + next).done(function(obj) {
        for (var i=0; i < obj.alarms.length; i++) {
            alarm = obj.alarms[i];

            var level_string;
            if (alarm.level >= 40) {
                alarm.message += ALARM_AUDIO;
                toastr.options = {'timeOut': 0, 'extendedTimeOut': 0, 'closeButton': true};
                level_string = "error";
            } else {
                toastr.options = {'timeOut': 20000};
                level_string = alarm_level_map[alarm.level] || "info";
            }

            toastr[level_string](alarm.message);

            // update latest alarm id
            latest = Math.max(latest,alarm.id);
        }
        setTimeout(function() { update_toastr(latest); },1000);
    });
}

//$.getJSON($SCRIPT_ROOT + '/get_alarm?start=-1').done(function(obj) {
//    update_toastr(obj.latest);
//});
