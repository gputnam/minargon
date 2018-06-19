function get_wire(card_id, fem_id, channel_id, detector) {
    var channel_base = 0;
    for (var i = 0; i < fem_id; i++) {
        channel_base += detector.n_channel_per_fem[i];
    }
    var channel = channel_base + channel_id;
    return detector.channel_to_wire[channel]; 
}
