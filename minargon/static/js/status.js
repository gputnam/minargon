function update_status(name, interval) {
    // update the program text status every 2 seconds
    // and color the row by applying a contextual class
    // see http://getbootstrap.com/css/#tables-contextual-classes
    if (typeof(seek) === 'undefined') seek = null;

    $.getJSON($SCRIPT_ROOT + '/get_status?name=' + name).done(function(obj) {
        if (obj.status == "ok") {
            $('#' + name).attr("class","success");
        }
        else if (obj.status === null) {
            obj.status = "Not Responding";
            $('#' + name).attr("class","danger");
        }
        else {
            $('#' + name).attr("class","warning");
        }

        $('#' + name + ' #status').text(obj.status);
        $('#' + name + ' #uptime').text(obj.uptime ? moment().subtract('seconds',obj.uptime).fromNow(true): "");

        setTimeout(function() { update_status(name,interval); }, interval*1000);
    });
}
