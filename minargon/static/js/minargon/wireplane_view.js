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
            ret.push(CHANNEL_DATA_TYPES[data_type].data_link(this.root, this.detector[this.plane].offset + i).name("wire " + i));
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

    param(param, datatype) {
        if (!(CHANNEL_DATA_TYPES[datatype].range === undefined)) {
            param["threshold_lo"] = CHANNEL_DATA_TYPES[datatype]["range"][0];
            param["threshold_hi"] = CHANNEL_DATA_TYPES[datatype]["range"][1];
        }
        else {
            param.threshold_lo = undefined;
            param.threshold_hi = undefined;
        }
        if (!(CHANNEL_DATA_TYPES[datatype].horizon_format === undefined)) {
            param.format = CHANNEL_DATA_TYPES[datatype].horizon_format;
        }
        return param;
    } 

    on_finish(datatype, initialized) {
        // sync the poll controlling the line chart/histogram with the new data
        updatePoll(datatype, this.plane, this.detector, initialized);
    }
}

function updatePoll(datatype, plane, detector, initialized) {
    if (initialized == false || poll.name() != datatype) {
        if (initialized == true) {
            // if there's new data, re-layout the histograms
            poll.stop();
            histogram.reLayout(layoutHisto(datatype, detector, plane));
            scatter.reLayout(layoutScatter(datatype));
        }

        poll = newPoll(datatype, histogram, scatter, detector, plane);
    }
}

// default layout for histograms
function layoutHisto(datatype, detector, plane) {
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

    if (!(CHANNEL_DATA_TYPES[datatype].range === undefined)) {
        layout.xaxis.range = CHANNEL_DATA_TYPES[datatype].range;
    }

    return layout;
}

// default layout for scatter plots
function layoutScatter(datatype) {
    var layout = {
        yaxis: {
            title: datatype,
        },
        xaxis: {
	    title: "wire",
        }
    }
    if (!(CHANNEL_DATA_TYPES[datatype].range === undefined)) {
        layout.yaxis.range = CHANNEL_DATA_TYPES[datatype].range;
    }
    return layout;
} 

function newHistogram(datatype, detector, plane, target) {
    var layout = layoutHisto(datatype, detector, plane);

    var n_data_points = detector[plane].n_wires;
    return new Histogram(n_data_points, target, layout);
} 


function newScatter(datatype, detector, plane, target) {
    var layout = layoutScatter(datatype);

    return new LineChart(detector[plane].n_wires, target, layout);
}

function newPoll(datatype, histogram, scatter, detector, plane) {
    // multi wire link querries a set of wires all at once
    var data_link = new D3DataLink(new MultiWireLink($SCRIPT_ROOT, datatype, detector[plane].offset, detector[plane].offset + detector[plane].n_wires));
    // sleep for 10 seconds in between polling
    var timeout = 10000;
    // tell the poll to update the histogram and the scatter plot
    var listeners = [histogram.updateData.bind(histogram), scatter.updateData.bind(scatter)];

    poll = new D3DataPoll(data_link, timeout, listeners);
    poll.run();
    return poll;
}

function flatten(arr) {
    return arr[0];
}

