// helper scripts for wireplane_view.html
// much of the code is very similar to readout_views.js
// TODO: could more code by combined somehow?

// class implementing the metric_info interface
class wireplane_metric_info {
    // detector: the detector dictionary as defined in constants.py of mianrgon
    // plane: one of the planes defined in detector
    constructor(detector, plane, root) {
        this.root = root;
        this.detector = detector;
        this.plane = plane;
    }

    // only list every 20 wires in cubism
    data_list(data_type, context) {
        var ret = [];
        for (var i = 0; i < this.detector[this.plane].n_wires; i += 20) {
            ret.push(CHANNEL_DATA_TYPES[data_type].data_link(this.root, this.detector[this.plane].offset + i).name("wire " + (i + this.detector[this.plane].offset)));
        } 
        return ret;
    }

    // when the user clicks on a horizon chart, takes them to the snapshot page of that wire
    on_click(horizon_name, horizon_index) {
        var args = {
            channel: this.detector[this.plane].offset + horizon_index * 20,
            step: Param().step,
        };
        window.location.href = $SCRIPT_ROOT + "/channel_snapshot?" + $.param(args);
    }

    param(param) {
        var datatype = param.data;
        if (!(CHANNEL_DATA_TYPES[datatype].range === undefined)) {
            param["threshold_lo"] = CHANNEL_DATA_TYPES[datatype]["range"][0];
            param["threshold_hi"] = CHANNEL_DATA_TYPES[datatype]["range"][1];
        }
        else {
            param.threshold_lo = undefined;
            param.threshold_hi = undefined;
        }
        if (!(CHANNEL_DATA_TYPES[datatype].warning_range === undefined)) {
            param.warning_range = [ 
              CHANNEL_DATA_TYPES[datatype]["warning_range"][0],
              CHANNEL_DATA_TYPES[datatype]["warning_range"][1]
            ];
        }
        else {
            param.range = undefined;
        }
        if (!(CHANNEL_DATA_TYPES[datatype].horizon_format === undefined)) {
            param.format = CHANNEL_DATA_TYPES[datatype].horizon_format;
        }
        return param;
    } 

    on_finish(param, is_new_data) {
        // sync the poll controlling the line chart/histogram with the new data
        updatePoll(param.data, this.plane, this.detector, param, is_new_data);
        // update the scatter plot warning ranges if need be
        scatter.updateRange(param.warning_range);
    }
}

function updatePoll(datatype, plane, detector, param, is_new_data) {

    histogram.reLayout(layoutHisto(datatype, param, detector, plane));
    scatter.reLayout(layoutScatter(datatype, param));

    if (is_new_data) {
        // if there's a poll, stop it
        if (!(poll === undefined)) poll.stop();
        poll = newPoll(datatype, histogram, scatter, detector, plane);

    }
}

// default layout for histograms
function layoutHisto(datatype, param, detector, plane) {
    var n_data_points = detector[plane].n_wires;

    var layout = {
        xaxis: {
            title: datatype,
        },
        yaxis: {
	    range: [0, n_data_points],
	    title: "N wires",
        }
    }

    if (!(param.threshold_hi === undefined)) {
        layout.xaxis.range = [param.threshold_lo, param.threshold_hi];
    }

    return layout;
}

// default layout for scatter plots
function layoutScatter(datatype, param) {
    var layout = {
        yaxis: {
            title: datatype,
        },
        xaxis: {
	    title: "wire",
        }
    }

    if (!(param.threshold_hi === undefined)) {
        layout.yaxis.range = [param.threshold_lo, param.threshold_hi];
    }

    return layout;
} 

function newHistogram(datatype, param, detector, plane, target) {
    var layout = layoutHisto(datatype, param, detector, plane);

    var n_data_points = detector[plane].n_wires;
    return new Histogram(n_data_points, target, layout);
} 


function newScatter(datatype, param, detector, plane, target) {
    var layout = layoutScatter(datatype, param);

    return new LineChart(detector[plane].n_wires, target, layout);
}

function newPoll(datatype, histogram, scatter, detector, plane) {
    // multi wire link querries a set of wires all at once
    var data_link = new D3DataLink(new MultiWireLink($SCRIPT_ROOT, datatype, detector[plane].offset, detector[plane].offset + detector[plane].n_wires));
    // sleep for 10 seconds in between polling
    var timeout = 10000;

    var update_time = function(data, start) {
        $("#update-time").html("Poll Time: " + moment(start).format("hh:mm:ss"));
        $("#update-subrun").html("Data SubRun: " + data.index[0]);
    }; 

    // tell the poll to update the histogram and the scatter plot
    var listeners = [histogram.updateData.bind(histogram), scatter.updateData.bind(scatter), update_time];

    poll = new D3DataPoll(data_link, timeout, listeners, check_update_state);
    poll.run();
    return poll;
}

function flatten(arr) {
    return arr[0];
}

