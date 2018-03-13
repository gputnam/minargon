function linspace(min, max, N) {
    var a = [];
    for (var i=0; i < N; i++) {
        a[i] = min + (max-min)*i/(N-1);
    }
    return a;
}

var xsnoed1 = ["#4876ff","#32cd32","#ffff00","#ffa500"],
    xsnoed2 = ["#3a5fcd","#2e8b57","#cd9b1d","#ffa500"];

var color_scales = {};
color_scales.xsnoed1 = xsnoed1;
color_scales.xsnoed2 = xsnoed2;
for (var key in colorbrewer) {
    color_scales[key] = colorbrewer[key][5];
}

color_scales = d3.entries(color_scales);

var color_scale = d3.scale.linear()
    .domain(linspace(0,0.001,8))
    .range(color_scales[12].value);

var crate = crate_view();
var crate_update = crate_view().scale(color_scale);

function setup(run) {

    // set up crate view
    d3.select("#crateX").datum([]).call(crate);
    d3.select("#crateY").datum([]).call(crate);
    d3.select("#crateZ").datum([]).call(crate);
    d3.select("#crateI").datum([]).call(crate);
    d3.select("#crateJ").datum([]).call(crate);

    // line break after crate 9 to get
    // XSNOED style
    $(".crate9").after("<br>");

    // Default values
    var i = [0, 4, 6];
    for(var x in i) {
       update(i[x], run);
    }
}

function update(trigger_type, run_number) {
    $.getJSON($SCRIPT_ROOT + '/query_occupancy', 
              { type: trigger_type, run: run_number }).done(function(result) {

        values = result.values;

        if(trigger_type == 0){
            d3.select('#crateX').datum(values).call(crate_update);
        }
        else if(trigger_type == 4){
            d3.select('#crateY').datum(values).call(crate_update);
        }
        else if(trigger_type == 6){
            d3.select('#crateZ').datum(values).call(crate_update);
        }
    });
}


