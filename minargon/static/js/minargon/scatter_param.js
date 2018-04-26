// listener for clicking linear/log scale buttons
$("#opt-scale :input").change(function() {
    // update histogram and scatter plot layouts 
    var param = Param();
    var layout_scatter = layoutScatter(param.data, metric_info.view_type, param);
    var layout_histo = layoutHisto(param.data, metric_info.view_type, metric_info.detector, param);
    layout_scatter.yaxis.type = $(this).val();
    layout_histo.yaxis.type = $(this).val();

    histogram.reLayout(layout_histo);
    scatter.reLayout(layout_scatter);
});

// function to check state of update state toggle
function check_update_state() {
    var run = $("#opt-update").children(".active").attr("id");
    if (run == "on") var ret = true;
    if (run == "off") var ret = false;
    return ret;
}

function update_page(args) {
    var url_root = [location.protocol, '//', location.host, location.pathname].join('');

    var selectors = $("#data-header-parent").find("select"); 
    selectors.each(function(index) {
        args[$(this).attr("id")] = $(this).val();
    });

    window.location.href = url_root + "?" + $.param(args);
}
