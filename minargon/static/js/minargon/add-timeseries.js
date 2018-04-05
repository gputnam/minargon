// Requires cubism.js loaded

function add_metrics(target, context, data_links, param) {
    // add new metrics
    var data = data_links.map(data_link => context.metric(data_link.get_data.bind(data_link), data_link.name()));
    make_horizons(target, context, data, param);
}

function delete_horizons(target, context) {
    // delete old metrics
    d3.select(target).selectAll('.horizon')
        .call(context.horizon().remove)
        .remove();    
}

function make_horizons(target, context, data, param) {
    var horizon = context.horizon();
    if (!(param === undefined || param.height === undefined)) {
      horizon = horizon.height(param.height);
    }
    if (!(param === undefined || param.threshold_lo === undefined || param.threshold_hi === undefined)) {
      horizon = horizon.extent([param.threshold_lo, param.threshold_hi]);
    }
    d3.select(target).selectAll('.horizon')
        .data(data)
      .enter().insert("div", ".bottom")
        .attr("class", "horizon")
      .call(horizon);
}

function create_cubism_context(target, step) {
    var size = $(target).width();
    var context = cubism.context()
        .serverDelay(1e3)
        .clientDelay(1e3)
        .step(step*1000)
        .size(size);    

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
                //.focusFormat(focus_format);
            d3.select(this).call(axis);
        });

    // delete old rule
    $(target + ' .rule').remove();

    d3.select(target).append("div")
        .attr("class", "rule")
        .call(context.rule());    

    return context;

}

function Param(newParam) {
    if (newParam === undefined) 
        return {
	    height: $("#data-height").val(),
	    threshold_lo: $("#threshold-lo").val(),
	    threshold_hi: $("#threshold-hi").val()
        };
    else {
        $("#data-height").val(newParam["height"]);
        $("#threshold-lo").val(newParam["threshold_lo"]);
        $("#threshold-hi").val(newParam["threshold_hi"]);
    } 
}


// update cubism options 
function updateStep(selector, datatype, context, param) { 
    context.step(selector.value*1000); 
    // re-make the data
    newData(datatype, context, param);
} 

function updateParam(target, context, param) {
    var data = d3.select(target).selectAll('.horizon').data();
    delete_horizons(target, context);
    make_horizons(target, context, data, param);
}

function updateData(target, context, data_links, param) {
    delete_horizons(target, context);
    add_metrics(target, context, data_links, param);
}


