// Requires cubism.js loaded

// Helper functions for using cubism horizon charts

// Most functions below attempt to be independent of html.
// One exception is the Param() function, which will assume you have fields
// with the id's as specified below. More specifically, it assumes your page is 
// using 'stream_options.html' or 'multistream_options.html' as defined in templates/
// 
// If you wish to use Param() without including either of those pages, then you should 
// implement a page with you're own fields that have the same id's. Alternatively,
// you can use this code with a 'metric_info' object (see below) that doesn't implement
// 'param'. In that case, the Param() function will never be called internally by this
// code, and you will be able to use it without errors. 

// The variable "metric_info" in the code below always refers to an object 
// implementing the "metric_info" interface, which has the following functions:
// data_list(data_type, context) (REQUIRED)
//     provides a list of D3DataLink/D3DataChain objects to be used as metrics
// param(param) (OPTIONAL)
//     provides the default parameters for a new data type. If not defined, 
//     param won't be updated on a data type update.
// on_click(data_type, horizon_index) (OPTIONAL)
//     function which will be called when a horizon chart is clicked
//     (`this` is set as the class)
// on_update(start, stop) (OPTIONAL)
//     function which will be called when a metric updates 
//     (`this` is set as the class)
// on_finish(param, is_new_data)
//     function which will be called after data or parameters are updated -- datatype name and
//     whether this call is the original initialization is provided

// For an example of an implementation of the metric info interface, see 
// readout_view_metric_info at the top of readout_views.js

// Other variables are commonly used:
// target: jquery-name (i.e. "#id" or ".class") of the div to be written to
// context: the cubism context
// data_links: a list of objects implementing the D3DataLink interface
// param: a dictionary of horizon options as returned by Param()

// add in metrics w/ a horizon chart to the provided target
function add_metrics(target, context, data_links, param, metric_info) {
    // add new metrics
    var data = data_links.map(function(data_link) { 
        var metric = context.metric(data_link.get_values.bind(data_link), data_link.name());
        if (!(metric_info.on_update === undefined)) {
            metric.on("change", metric_info.on_update.bind(metric_info));
        }
        return metric;
    });
    return make_horizons(target, context, data, param, metric_info);
}

// delete the horizons and the associated metrics
function delete_horizons(target, context) {
    d3.select(target).selectAll('.horizon')
        .call(context.horizon().remove)
        .remove();
}

// make new horizon objects
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

// make a new cubism context with the given time-step in seconds
function create_cubism_context(target, step) {
    var size = $(target).width();
    var context = cubism.context()
        .serverDelay(1000 * 1.5 * 60 /* 1 minute when running offline */)
        .clientDelay(1000 * 60)
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
                .orient(d);
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

// If 'newParam' is not provided, will return the current horizon parameters
// by looking in the appropriate fields. 
// Otherwise will update those fields to the appropriate parameters.
function Param(newParam) {
    if (newParam === undefined) 
        return {
            data: $("#data-type").val(),
	    height: $("#data-height").val(),
	    threshold_lo: $("#threshold-lo").val(),
	    threshold_hi: $("#threshold-hi").val(),
            step: $("#data-step").val(),
            warning_range: [$("#warning-lo").val(), $("#warning-hi").val()],
        };
    else {
        /*// also update the link
        var url_root = [location.protocol, '//', location.host, location.pathname].join('');
        var title = document.title;
        window.history.replaceState({}, title, url_root + "?" + $.param(newParam));*/

        $("#data-height").val(newParam["height"]);

        if (!(newParam.data == undefined)) {
          $("#data-type").val(newParam.data);
        }
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
        if (!(newParam.step === undefined)) {
          $("#data-step").val(newParam.step);
        }
        if (!(newParam.warning_range === undefined)) {
          $("#warning-lo").val(newParam.warning_range[0]);
          $("#warning-hi").val(newParam.warning_range[1]);
        }
        else {
          $("#warning-lo").val("");
          $("#warning-hi").val("");
        }
    } 
}


// update cubism options 
// selector: the html object that called this function
// selector.step is the new context step in seconds
// datatype: the current data type in cubism metrics
function updateStep(selector, target, datatype, context, param, metric_info) { 
    context.step(selector.value*1000); 
    // re-make the data
    updateData(target, context, param, datatype, metric_info, true, false);
} 

function updateParam(target, context, param, metric_info) {
    var data = d3.select(target).selectAll('.horizon').data();
    delete_horizons(target, context);

    var ret = make_horizons(target, context, data, param, metric_info);
    if (!(metric_info.on_finish === undefined)) {
        metric_info.on_finish(param, false);
    }

    return ret;
}

// data_type: the new data type to be used in cubism metrics
// remove_old: boolean, whether to delete old horizon charts
//      optional argument, will default to false
// is_new_data: boolean, whether the given data_type is different than the 
// current data_type in the horizon charts
//      optional argument, will default to true
function updateData(target, context, param, data_type, metric_info, remove_old, is_new_data) {
    if (remove_old === true) {
        delete_horizons(target, context);
    }
    var data_links = metric_info.data_list(data_type, context); 

    if (!(metric_info.param === undefined)) {
        param = metric_info.param(param);
        Param(param);
    }

    var ret = add_metrics(target, context, data_links, param, metric_info);

    if (!(is_new_data === false) && !(metric_info.on_finish === undefined)) {
        var new_data = !(is_new_data === false) || remove_old;
        metric_info.on_finish(param, new_data);
    }
    return ret;
}

// formatting for displaying numbers
// taken from minard
si_format = d3.format('.4s');
float_format = d3.format('.4f');
percent_format = d3.format('.4%');

function clean_format(d, format) {
  if (!$.isNumeric(d))
    return '-';
  else
    return format(d);
}

