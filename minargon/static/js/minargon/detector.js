function get_wire(crate_id, slot_id, channel_id, detector) {
    var channel = slot_id * detector.n_channel_per_fem + channel_id;
    return detector.channel_to_wire[channel];
}
