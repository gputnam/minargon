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
    d3.select(target).selectAll('.horizon')
        .data(data)
      .enter().insert("div", ".bottom")
        .attr("class", "horizon")
      .call(context.horizon()
          .height(param["height"])
          .extent( (param["threshold_lo"] === undefined || param["threshold_hi"] == undefined)
              ? null : [param["threshold_lo"], param["threshold_hi"]]));
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

// update cubism options 
function updateStep(selector, context) { 
    context.step(selector.value*1000); 
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


