function newDaqData(selector, view_type, view_ind, detector) {
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
    var param = Param();
    param["threshold_lo"] = DATA_TYPES[selector.value]["default_thresholds"][0];
    param["threshold_hi"] = DATA_TYPES[selector.value]["default_thresholds"][1];
    Param(param);

    updateData('#timeseries', context, datum_list(selector.value, view_ind, detector), param);
}

function fem_datum_list(name, view_ind, detector) {
    var datums = [];
    for (var i = 0; i < detector.n_fem_per_board; i++) {
        datums.push(FEM_DATA_TYPES[name].data_link($SCRIPT_ROOT, view_ind.card, i));
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

