// Helper javascript for the "readout" view pages
// (wires, fem_view, board_view)

// class implementing the "metric_info" interface as defined in timeseries.js
class crate_view_metric_info {
    // view_type: the string name of the view (wire/fem,board)
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
        return datum_list(data_type, this.view_ind, this.detector);
    }

    // on clicking on a strip chart, go to the page with the appropriate data
    on_click(horizon_name, horizon_index) {
        var base_link;
        var args;
        // channel_view -> channel_snapshot
        if (this.view_type == "channel") {
            base_link = "channel_snapshot";
            args = {
                channel: get_wire(this.view_ind.card, this.view_ind.fem, horizon_index, this.detector),
                step: Param().step,
            };
        }
        // fem_view -> channel_view
        else if (this.view_type == "fem") {
            base_link = "channel_view";
            args = {
                card: this.view_ind.card,
                fem: horizon_index,
                data: $("#data-type").val(),
                step: Param().step,
            }; 
        }
        // board_view -> fem_view
        else if (this.view_type == "board") {
            base_link = "fem_view";
            args = {
                card: horizon_index,
                data: $("#data-type").val(),
                step: Param().step,
            }; 
        }
        window.location.href = $SCRIPT_ROOT + "/" + base_link + "?" + $.param(args);
    }

    param(param, datatype) {
        // get the default thresholds/horizon format from the datatype
        var view_info = dispatchViewType(this.view_type);
        var datum_list = view_info[0];
        var DATA_TYPES = view_info[1];

        if (!(DATA_TYPES[datatype].range === undefined)) {
            param["threshold_lo"] = DATA_TYPES[datatype]["range"][0];
            param["threshold_hi"] = DATA_TYPES[datatype]["range"][1];
        }
        else {
            param.threshold_lo = undefined;
            param.threshold_hi = undefined;
        }
        if (!(DATA_TYPES[datatype].horizon_format === undefined)) {
            param.format = DATA_TYPES[datatype].horizon_format;
        }
        return param;
    } 

    on_finish(datatype, initialized) {
        // sync the poll controlling the line chart/histogram with the new data
        updatePoll(datatype, this.view_type, this.detector, this.view_ind, initialized);
    }
}

function updatePoll(datatype, view_type, detector, view_ind, initialized) {
    if (initialized == false || poll.name() != datatype) {
        if (initialized == true) {
            // if there's new data, re-layout the histograms
            poll.stop();
            histogram.reLayout(layoutHisto(datatype, view_type, detector));
            scatter.reLayout(layoutScatter(datatype, view_type));
        }

        poll = newPoll(datatype, view_type, histogram, scatter, view_ind, detector);
    }
}

// given view type, returns the appropriate:
// datum_list: a function returning a list of D3DataLink objects for the appropriate view
// DATA_TYPES: a dictionary mapping data_types to default parameters, as defined in Data.js
function dispatchViewType(view_type) {
    var datum_list;
    var DATA_TYPES;
    if (view_type == "channel") {
        datum_list = channel_datum_list;
        DATA_TYPES = CHANNEL_DATA_TYPES;
    }
    else if (view_type == "fem") {
        datum_list = fem_datum_list;
        DATA_TYPES = FEM_DATA_TYPES;
    }
    else if (view_type == "board") {
        datum_list = board_datum_list;
        DATA_TYPES = BOARD_DATA_TYPES;
    }
    return [datum_list, DATA_TYPES];
}

// get the number of data points on (e.g.) a histogram given the view type
function getDataPoints(view_type, detector) {
    if (view_type == "channel") {
        return detector.n_channel_per_fem;
    }
    else if (view_type == "fem") {
        return detector.n_fem_per_board;
    }
    else if (view_type == "board") {
        return detector.n_boards;
    }
}

// default layout for histograms
function layoutHisto(datatype, view_type, detector) {
    var data_types = dispatchViewType(view_type)[1];

    var n_data_points = getDataPoints(view_type, detector);

    var layout = {
        xaxis: {
            title: datatype,
        },
        yaxis: {
	    range: [0, n_data_points],
	    title: "N " + view_type,
        }
    }

    if (!(data_types[datatype].range === undefined)) {
        layout.xaxis.range = data_types[datatype].range;
    }

    return layout;
}

function newHistogram(datatype, view_type, detector, target) {
    var layout = layoutHisto(datatype, view_type, detector);

    return new Histogram(getDataPoints(view_type, detector), target, layout); 
} 

// default layout for scatter plots
function layoutScatter(datatype, view_type) {
    var data_types = dispatchViewType(view_type)[1];
    var layout = {
        yaxis: {
            title: datatype,
        },
        xaxis: {
	    title: view_type,
        }
    }
    if (!(data_types[datatype].range === undefined)) {
        layout.yaxis.range = data_types[datatype].range;
    }
    return layout;
} 

function newScatter(datatype, view_type, detector, target) {
    var layout = layoutScatter(datatype, view_type);

    return new LineChart(getDataPoints(view_type, detector), target, layout);
}


function newPoll(datatype, view_type, histogram, scatter, view_ind, detector) {
    var view_info = dispatchViewType(view_type);
    var datum_list = view_info[0];
    var DATA_TYPES = view_info[1];

    // chain each individual readout D3DataLink into a D3DataChain
    var data_chain = new D3DataChain(datum_list(datatype, view_ind, detector), datatype, flatten);
    // sleep for 10 seconds in between polling
    var timeout = 10000;
    // tell the poll to update the histogram and the scatter plot
    var listeners = [histogram.updateData.bind(histogram), scatter.updateData.bind(scatter)];
    

    poll = new D3DataPoll(data_chain, timeout, listeners);
    poll.run();
    return poll;
}

// datum_lists for each of the three view_types
function board_datum_list(name, view_ind, detector) {
    var datums = [];
    for (var i = 0; i < detector.n_boards; i++) {
        datums.push(BOARD_DATA_TYPES[name].data_link($SCRIPT_ROOT, i).name("board " + i));
    }
    return datums;
}

function fem_datum_list(name, view_ind, detector) {
    var datums = [];
    for (var i = 0; i < detector.n_fem_per_board; i++) {
        datums.push(FEM_DATA_TYPES[name].data_link($SCRIPT_ROOT, view_ind.card, i).name("fem " + i));
    }
    return datums;
}

function channel_datum_list(name, view_ind, detector) {
    var datums = [];
    for (var i = 0; i < detector.n_channel_per_fem; i++) {
        datums.push(CHANNEL_DATA_TYPES[name].data_link($SCRIPT_ROOT, get_wire(view_ind.card, view_ind.fem, i, detector)).name("channel " + i));
    }
    return datums;
}

function flatten(arr) {
    return arr[0];
}

