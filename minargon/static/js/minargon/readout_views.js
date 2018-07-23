// Helper javascript for the "readout" view pages
// (wires, fem_view, crate_view)

// class implementing the "metric_info" interface as defined in timeseries.js
class crate_view_metric_info {
    // view_type: the string name of the view (wire/fem,crate)
    // view_ind: dictionary defining the location of the object in the readout
    // detector: info on the detector. Should be taken from constants.py in flask
    constructor(view_type, view_ind, detector) {
        this.view_type = view_type;
        this.view_ind = view_ind;
        this.detector = detector;
    }

    data_list(data_type, context) {
        // get the proper data list based on the view type
        var view_info = dispatchViewType(this.view_type);
        var datum_list = view_info[0];
        var ret = datum_list(data_type, this.view_ind, this.detector);
        // pair the list down if it is too big
        if (ret.length > 16) {
           var skip = Math.floor(ret.length / 16);
           var small_ret = [];
           for (var i = 0; i < ret.length; i+= skip) {
               small_ret.push(ret[i]);
           }
           return small_ret;
        }
        return ret;
    }

    // on clicking on a strip chart, go to the page with the appropriate data
    on_click(horizon_name, horizon_index) {
        var base_link;
        var args;
        // channel_view -> channel_snapshot
        if (this.view_type == "fem") {
            base_link = "channel_snapshot";
            var readout_channel = Number(String(horizon_name).split(" ")[1]);
            args = {
                channel: get_wire(this.view_ind.crate, this.view_ind.fem, readout_channel, this.detector),
                step: Param().step,
            };
        }
        // fem_view -> channel_view
        else if (this.view_type == "crate") {
            base_link = "fem_view";
            args = {
                crate: this.view_ind.crate,
                fem: horizon_index,
            }; 
            args = Object.assign({}, args, Param());
        }
        // crate_view -> fem_view
        else if (this.view_type == "readout") {
            base_link = "crate_view";
            args = {
                crate: horizon_index,
            }; 
            args = Object.assign({}, args, Param());
        }
        window.location.href = $SCRIPT_ROOT + "/" + base_link + "?" + $.param(args);
    }

    param(param) {
        // get the default thresholds/horizon format from the datatype
        var view_info = dispatchViewType(this.view_type);
        var datum_list = view_info[0];
        var DATA_TYPES = view_info[1];
        var datatype = param.data;

        if (!(DATA_TYPES[datatype].range === undefined)) {
            param["threshold_lo"] = DATA_TYPES[datatype]["range"][0];
            param["threshold_hi"] = DATA_TYPES[datatype]["range"][1];
        }
        else {
            param.threshold_lo = undefined;
            param.threshold_hi = undefined;
        }
        if (!(DATA_TYPES[datatype].warning_range === undefined)) {
            param.warning_range = [ 
              DATA_TYPES[datatype]["warning_range"][0],
              DATA_TYPES[datatype]["warning_range"][1]
            ];
        }
        else {
            param.warning_range = undefined;
        }
        if (!(DATA_TYPES[datatype].horizon_format === undefined)) {
            param.format = DATA_TYPES[datatype].horizon_format;
        }
        return param;
    } 

    on_finish(param, is_new_data) {
        // sync the poll controlling the line chart/histogram with the new data
        updatePoll(param.data, this.view_type, this.detector, this.view_ind, param, is_new_data);
        // update the scatter plot warning ranges if need be
        scatter.updateRange(param.warning_range);
    }
}

function updatePoll(datatype, view_type, detector, view_ind, param, is_new_data) {
    histogram.reLayout(layoutHisto(datatype, view_type, view_ind, detector, param));
    scatter.reLayout(layoutScatter(datatype, view_type, view_ind, detector, param));

    // if there's new data, stop the old poll
    if (is_new_data == true) {
        // if there is a poll, stop it
        if (!(poll === undefined)) poll.stop();

	poll = newPoll(datatype, view_type, histogram, scatter, view_ind, detector, param);
    }
}

// given view type, returns the appropriate:
// datum_list: a function returning a list of D3DataLink objects for the appropriate view
// DATA_TYPES: a dictionary mapping data_types to default parameters, as defined in Data.js
function dispatchViewType(view_type) {
    var datum_list;
    var DATA_TYPES;
    var name;
    if (view_type == "fem") {
        name = "channel";
        datum_list = channel_datum_list;
        DATA_TYPES = CHANNEL_DATA_TYPES;
    }
    else if (view_type == "crate") {
        name = "fem";
        datum_list = fem_datum_list;
        DATA_TYPES = FEM_DATA_TYPES;
    }
    else if (view_type == "readout") {
        name = "crate";
        datum_list = crate_datum_list;
        DATA_TYPES = CRATE_DATA_TYPES;
    }
    return [datum_list, DATA_TYPES, name];
}

// get the number of data points on (e.g.) a histogram given the view type
function getDataPoints(view_type, view_ind, detector) {
    if (view_type == "fem") {
        return detector.n_channel_per_fem[view_ind.fem];
    }
    else if (view_type == "crate") {
        return detector.n_fem_per_crate;
    }
    else if (view_type == "readout") {
        return detector.n_crates;
    }
}

function titleize(str) {
    return str.replace(/_/g, ' ').replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

// default layout for histograms
function layoutHisto(datatype, view_type, view_ind, detector, param, run, subrun) {
    var data_types = dispatchViewType(view_type)[1];
    var name = dispatchViewType(view_type)[2];

    var n_data_points = getDataPoints(view_type, view_ind, detector);

    var title = name + " " + datatype;
    if (!(run === undefined) && !(subrun === undefined)) {
        title = title + " run " + run + " subrun " + subrun;
    }

    var layout = {
        title: titleize(title),
        xaxis: {
            title: datatype,
        },
        yaxis: {
	    range: [0, n_data_points],
	    title: "N " + name,
        }
    }

    if (!(param.threshold_lo === undefined)) {
        layout.xaxis.range = [param.threshold_lo, param.threshold_hi];
    }
    if (param.log_scale === true) {
        layout.xaxis.type = "log";
    }

    return layout;
}

function newHistogram(datatype, view_type, view_ind, detector, target, param) {
    var layout = layoutHisto(datatype, view_type, view_ind, detector, param);

    return new Histogram(getDataPoints(view_type, view_ind, detector), target, layout); 
} 

// default layout for scatter plots
function layoutScatter(datatype, view_type, view_ind, detector, param, run, subrun) {
    var data_types = dispatchViewType(view_type)[1];
    var name = dispatchViewType(view_type)[2];

    var title = name + " " + datatype;
    if (!(run === undefined) && !(subrun === undefined)) {
        title = title + " run " + run + " subrun " + subrun;
    }

    var layout = {
        title: titleize(title),
        yaxis: {
            title: datatype,
        },
        xaxis: {
	    title: name,
        }
    }
    if (!(param.threshold_lo === undefined)) {
        layout.yaxis.range = [param.threshold_lo, param.threshold_hi];
    }
    if (param.log_scale === true) {
        layout.yaxis.type = "log";
    }
    return layout;
} 

function newScatter(datatype, view_type, view_ind, detector, target, param) {
    var layout = layoutScatter(datatype, view_type, view_ind, detector, param);

    return new LineChart(getDataPoints(view_type, view_ind, detector), target, layout);
}


function newPoll(datatype, view_type, histogram, scatter, view_ind, detector, param) {
    var view_info = dispatchViewType(view_type);
    var datum_list = view_info[0];
    var DATA_TYPES = view_info[1];

    // chain each individual readout D3DataLink into a D3DataChain
    var data_chain = new D3DataChain(datum_list(datatype, view_ind, detector), datatype, flatten);
    // sleep for 10 seconds in between polling
    var timeout = 10000;

    // a listener to update the time
    var update_time = function(data, start) {
        $("#update-time").html("Poll Time: " + moment(start).format("HH:mm:ss"));
    }; 

    var re_title = function(data, start) {
        histogram.reLayout(layoutHisto(datatype, view_type, view_ind, detector, Param(), data.index[0].run, data.index[0].subrun));
        scatter.reLayout(layoutScatter(datatype, view_type, view_ind, detector, Param(), data.index[0].run, data.index[0].subrun));
    }

    // tell the poll to update the histogram and the scatter plot
    var listeners = [histogram.updateData.bind(histogram), scatter.updateData.bind(scatter), update_time, re_title];

    poll = new D3DataPoll(data_chain, timeout, listeners, check_update_state, get_run, get_subrun);
    poll.run();
    return poll;
}

// datum_lists for each of the three view_types
function crate_datum_list(name, view_ind, detector) {
    var datums = [];
    for (var i = 0; i < detector.n_crates; i++) {
        datums.push(CRATE_DATA_TYPES[name].data_link($SCRIPT_ROOT, i).name("crate " + i));
    }
    return datums;
}

function fem_datum_list(name, view_ind, detector) {
    var datums = [];
    for (var i = 0; i < detector.n_fem_per_crate; i++) {
        datums.push(FEM_DATA_TYPES[name].data_link($SCRIPT_ROOT, view_ind.crate, i).name("fem " + i));
    }
    return datums;
}

function channel_datum_list(name, view_ind, detector) {
    var datums = [];
    for (var i = 0; i < detector.n_channel_per_fem[view_ind.fem]; i++) {
        datums.push(CHANNEL_DATA_TYPES[name].data_link($SCRIPT_ROOT, get_wire(view_ind.crate, view_ind.fem, detector.fem_active_channels[view_ind.fem][i], detector))
            .name("channel " + detector.fem_active_channels[view_ind.fem][i]));
    }
    return datums;
}

function flatten(arr) {
    return arr[0];
}

