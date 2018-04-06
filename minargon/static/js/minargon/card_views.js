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

function newDaqData(datatype, view_type, view_ind, detector, initialized) {
    var view_info = dispatchViewType(view_type);
    var datum_list = view_info[0];
    var DATA_TYPES = view_info[1];

    var param = Param();
    param["threshold_lo"] = DATA_TYPES[datatype]["default_thresholds"][0];
    param["threshold_hi"] = DATA_TYPES[datatype]["default_thresholds"][1];
    Param(param);

    if (initialized == false || poll.name() != datatype) {
        if (initialized == true) poll.stop();

        poll = newPoll(datatype, view_type, histogram, view_ind, detector);
    }

    updateData('#timeseries', context, datum_list(datatype, view_ind, detector), param, initialized);
}

function newPoll(datatype, view_type, histogram, view_ind, detector) {
    var view_info = dispatchViewType(view_type);
    var datum_list = view_info[0];
    var DATA_TYPES = view_info[1];

    var data_chain = new D3DataChain(datum_list(datatype, view_ind, detector), datatype, flatten);
    var timeout = 10000;
    var listeners = [histogram.updateData.bind(histogram)];
    

    poll = new D3DataPoll(data_chain, timeout, listeners);
    poll.run();
    return poll;
}

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
        datums.push(CHANNEL_DATA_TYPES[name].data_link($SCRIPT_ROOT, get_wire(view_ind.card, view_ind.fem, i)).name("channel " + i));
    }
    return datums;
}

function flatten(arr) {
    return arr[0];
}

