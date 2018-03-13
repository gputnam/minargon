var discriminator_chart = histogram()
    .xlabel('Discriminator Threshold (DAC Counts)')
    .bins(40)
    .min_bin_width(1)

var discriminator_chart2 = histogram()
    .xlabel('Discriminator Threshold (DAC Counts)')
    .bins(40)
    .min_bin_width(1)
    .color_scale(d3.scale.linear().domain([0,1]).range(['darkgreen','darkgreen']))

