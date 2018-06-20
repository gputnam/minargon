window.setInterval(function() {
    d3.json($SCRIPT_ROOT + "/analysis_alive_time", function(result) { 
      var timestamp = result.value;
      var time = moment.unix(timestamp).format("hh:mm:ss")
      $("#analysis-alive-time").html("Analysis alive time: " + time);
    });

}, 1000);
