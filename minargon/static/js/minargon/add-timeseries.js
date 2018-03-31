// Requires cubism.js loaded

function add_metrics(target, context, data_links, height) {
    d3.select(target).selectAll(".horizon")
      .data(data_links.map(data_link => context.metric(data_link.get_data.bind(data_link), data_link.name())))
      .enter().insert("div", ".bottom")
        .attr("class", "horizon")
      .call(context.horizon().height(height));  
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

function updateHeight(selector, horizons) {
    horizons.map((horizon) => horizon.height(selector.value));
}

function updateData(horizons, datums) {
    horizons.map(function(horizon, i) { 
        horizon.metric(context.metric(datums[i].get_data.bind(datums[i]), datums[i].name()));
    });
}


