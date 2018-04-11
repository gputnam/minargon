// Requires cubism.js loaded

// The "metric_info" argument should be a class with the following functions:
// data_list(data_type, context)
//     provides a list of D3DataLink/D3DataChain objects to be used as metrics
// param(param, data_type) (OPTIONAL)
//     provides the default parameters for a new data type. If not defined, 
//     param won't be updated on a data type update.
// on_click(data_type, horizon_index) (OPTIONAL)
//     function which will be called when a horizon chart is clicked
//     (this is set as the class)
// on_update(start, stop) (OPTIONAL)
//     function which will be called when a metric updates 
//     (this is set as the class)
// on_finish(datatype, initialized)
//     function which will be called after data is updated -- datatype name and
//     whether this is the original initialization is provided

function add_metrics(target, context, data_links, param, metric_info) {
    // add new metrics
    var data = data_links.map(function(data_link) { 
        var metric = context.metric(data_link.get_data.bind(data_link), data_link.name());
        if (!(metric_info.on_upadte === undefined)) {
            metric.on("change", metric_info.on_update.bind(metric_info));
        }
        return metric;
    });
    return make_horizons(target, context, data, param, metric_info);
}

function delete_horizons(target, context) {
    // delete old metrics
    d3.select(target).selectAll('.horizon')
        .call(context.horizon().remove)
        .remove();
}

function make_horizons(target, context, data, param, metric_info) {
    var horizon = context.horizon();
    if (!(param === undefined || param.height === undefined)) {
      horizon = horizon.height(param.height);
    }
    if (!(param === undefined || param.threshold_lo === undefined || param.threshold_hi === undefined)) {
      horizon = horizon.extent([param.threshold_lo, param.threshold_hi]);
    }
    if (!(param === undefined || param.format === undefined)) {
      horizon = horizon.format(param.format);
    }
    var horizons = d3.select(target).selectAll('.horizon')
        .data(data)
      .enter().insert("div", ".bottom")
        .attr("class", "horizon")
      .call(horizon);
    if (!(metric_info.on_click === undefined)) {
         horizons.on("click", metric_info.on_click.bind(metric_info));
    }
    return horizons;
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

        if (!(newParam.threshold_lo === undefined)) {
          $("#threshold-lo").val(newParam["threshold_lo"]);
        }
        else {
          $("#threshold-lo").val("");
        }

        if (!(newParam.threshold_hi === undefined)) {
          $("#threshold-hi").val(newParam["threshold_hi"]);
        }
        else {
          $("#threshold-hi").val("");
        }
    } 
}


// update cubism options 
function updateStep(selector, target, datatype, context, param, metric_info) { 
    context.step(selector.value*1000); 
    // re-make the data
    updateData(target, context, param, datatype, metric_info, true, false);
} 

function updateParam(target, context, param, metric_info) {
    var data = d3.select(target).selectAll('.horizon').data();
    delete_horizons(target, context);
    return make_horizons(target, context, data, param, metric_info);
}

function updateData(target, context, param, data_type, metric_info, remove_old, is_new_data) {
    if (remove_old === true) {
        delete_horizons(target, context);
    }
    var data_links = metric_info.data_list(data_type, context); 

    if (!(is_new_data === false) && !(metric_info.param === undefined)) {
        param = metric_info.param(param, data_type);
    }

    var ret = add_metrics(target, context, data_links, param, metric_info);

    if (!(is_new_data === false) && !(metric_info.on_finish === undefined)) {
        metric_info.on_finish(data_type, remove_old);
    }
    return ret;
}

// formatting for displaying numbers
// taken from minard
si_format = d3.format('.2s');
float_format = d3.format('.2f');
percent_format = d3.format('.2%');

function clean_format(d, format) {
  if (!$.isNumeric(d))
    return '-';
  else
    return format(d);
}

