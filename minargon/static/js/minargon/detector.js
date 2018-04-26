// TODO: Implement
function get_wire(card_id, fem_id, channel_id, detector) {
    // TEMPORARY IMPLEMENTATION FOR TEST ON LARIAT DATA
    return card_id * detector.n_fem_per_crate * detector.n_channel_per_fem + fem_id * detector.n_channel_per_fem + channel_id;
}
