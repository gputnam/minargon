function linspace(start, stop, num)
{
    var a = new Array();
    for (var i=0; i < num; i++)
        a[i] = start + (stop-start)*i/(num-1);
    return a;
}

function histogram() {
    var margin = {top: 20, right: 25, bottom: 50, left: 50},
        log = false,
        width = null,
        height = null,
        xlabel = '',
        ylabel = '',
        bins = 20,
        min_bin_width = 0,
        color_scale = d3.scale.linear().domain([0,1]).range(['steelblue','steelblue']);
        on_scale_change = null,
        domain = null;

    function chart(selection) {
        selection.each(function(values) {
            if (width === null)
                width = $(this).width() - margin.left - margin.right;

            if (height === null)
                height = Math.round(width/1.6) - margin.top - margin.bottom;

            var svg = d3.select(this).selectAll("svg").data([values]);

            var genter = svg.enter().append('svg')
                    .attr('width', width + margin.left + margin.right)
                    .attr('height', height + margin.top + margin.bottom)
                    .attr('pointer-events','all');

            svg.selectAll('g').attr('opacity', values.length ? 1 : 0.25);

            if (values.length == 0)
            {
                // no data available
                if (typeof(this.__x) == 'undefined')
                {
                    // no chart exists, add missing class
                    // to display picture
                    svg.classed('missing', true);
                }

                var text = svg.selectAll('.missing-text').data([null]);

                text.enter().append('text')
                    .attr('x', width/2 + margin.left)
                    .attr('y', height/2 + margin.top)
                    .attr('opacity', 1.0)
                    .attr('text-anchor', 'middle')
                    .attr('dy', '0.5em')
                    .attr('class', 'missing-text')
                    .text("Data missing or currently unavailable.");

                return;
            }

            // convert values -> number
            values = values.map(Number);

            svg.classed('missing', false);
            svg.selectAll('.missing-text').remove();

            var genter = svg.selectAll('g').data([values]).enter().append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

            // background rectangle
            genter.append("rect")
                .attr("opacity",0)
                .attr("width",width)
                .attr("height",height);

            // x-axis
            genter.append('g').attr('class', 'x axis').attr('id','x-axis')
                .attr('transform', 'translate(0,' + height + ')');

            // y-axis
            genter.append('g').attr('class', 'y axis').attr('id','y-axis');

            // x label
            genter.append('text')
                .attr('class', 'x label')
                .attr('text-anchor', 'middle')
                .attr('x', width/2)
                .attr('y', height + margin.bottom)
                .text(xlabel);

            // y label
            genter.append('text')
                .attr('class', 'y label')
                .attr('text-anchor', 'end')
                .attr('y', 6)
                .attr('dy', '.75em')
                .attr('transform', 'rotate(-90)')
                .text(ylabel);

            // save the dom element to access it later.
            // The x scale is stored as element.__x to maintain state between updates.
            // This is kinda hacky but I'm not sure of a better way.
            var element = this;

            draw();

            svg.selectAll('g').selectAll('rect,#x-axis')
                .on('mousedown', function(d) { 
                    mouse_down = d3.mouse(element);
                    var x_down = d3.scale.linear().domain(element.__x.domain()).range([0,width]);

                    var id = this.id;

                    d3.event.preventDefault();

                    d3.select(window)
                        .on('mousemove', function(d) {
                            if (x_down !== null) {
                                var mouse = d3.mouse(element);
                                if (id == 'x-axis') {
                                    var scale = (x_down(mouse_down[0])/x_down(mouse[0]))
                                    if (scale > 0) {
                                    element.__x.domain([x_down.domain()[0],x_down.domain()[1]*scale]);
                                    }
                                } else {
                                    var dx = x_down.invert(mouse_down[0]) - x_down.invert(mouse[0]);
                                    element.__x.domain([x_down.domain()[0] + dx, x_down.domain()[1] + dx])
                                }
                                draw();
                            }
                        d3.event.preventDefault();
                        })
                        .on('mouseup', function(d) {
                            if (x_down !== null) {
                                var mouse = d3.mouse(element);
                                if (id == 'x-axis') {
                                    var scale = (x_down(mouse_down[0])/x_down(mouse[0]))
                                    if (scale > 0) {
                                    element.__x.domain([x_down.domain()[0],x_down.domain()[1]*scale]);
                                    }
                                } else {
                                    var dx = x_down.invert(mouse_down[0]) - x_down.invert(mouse[0]);
                                    element.__x.domain([x_down.domain()[0] + dx, x_down.domain()[1] + dx])
                                }

                                if (on_scale_change !== null)
                                    on_scale_change();

                                draw();
                            }
                            x_down = null;
                            d3.select(window).on('mouseup',null);
                            d3.select(window).on('mousemove',null);
                        });
                });

            function draw() {
                var x;
                if (typeof element.__x === "undefined")
                {
                    // x scale doesn't exist yet, so create it
                    x = d3.scale.linear()
                        .range([0,width]);

                    if (domain !== null) {
                        x.domain(domain)
                    } else {
                        values.sort(d3.ascending);

                        var xmax = values[values.length-1];
                        var q2 = d3.quantile(values,0.5);
                        var dq = d3.quantile(values,0.75) - q2;
                        xmax = xmax > q2 + 10*dq ? q2 + 10*dq : xmax;

                        x.domain([d3.min(values), xmax])
                    }

                    element.__x = x;
                } else {
                    x = element.__x;
                }

                // bin the data
                var ticks = x.ticks(bins);

                if ((ticks[1] - ticks[0]) < min_bin_width) {
                    ticks = x.ticks(Math.floor((x.domain()[1]-x.domain()[0])/min_bin_width));
                }
                var data = d3.layout.histogram()
                    .bins(ticks)
                    (values);

                if (log) {
                    var y = d3.scale.log()
                        .domain([.1,d3.max(data, function(d) { return d.y; })])
                        .range([height,0]);
                } else {
                    var y = d3.scale.linear()
                        .domain([0,d3.max(data, function(d) { return d.y; })])
                        .range([height,0]);
                }

                var x_axis = d3.svg.axis()
                    .scale(x)
                    .orient("bottom");

                var y_axis = d3.svg.axis()
                    .scale(y)
                    .orient("left");

                if (log) {
                    y_axis.tickFormat(function (d) {
                        return y.tickFormat(4,d3.format(',d'))(d); });
                }

                color_scale.domain(linspace(x.domain()[0],x.domain()[1],color_scale.range().length));

                var bin_width = Math.floor(data[0].dx*(x.range()[1]-x.range()[0])/(x.domain()[1] - x.domain()[0])) - 1;

                var g = svg.select('g')

                g.select('.x.axis').transition().call(x_axis);
                g.select('.y.axis').transition().call(y_axis);

                g.select('.x.label').transition().text(xlabel);
                g.select('.y.label').transition().text(ylabel);

                var bar = g.selectAll('.hist-bar')
                    .data(data);

                bar.transition()
                    .attr("x", function(d) { return x(d.x); })
                    .attr("y", function(d) { return y(d.y); })
                    .attr("fill", function(d) { return color_scale(d.x); })
                    .attr('width', bin_width)
                    .attr('height', function(d) { return height - y(d.y) - 1; })
                    .style({opacity: 1});

                bar.enter().append("rect")
                    .attr("class", "hist-bar")
                    .attr("x", function(d) { return x(d.x); })
                    .attr("y", function(d) { return y(d.y); })
                    .attr("fill", function(d) { return color_scale(d.x); })
                    .attr('width', bin_width)
                    .attr('height', function(d) { return height - y(d.y) - 1; })
                    .style({opacity: 1});

                bar.exit().transition().style({opacity: 0}).remove();
            }
        });
    }

    chart.domain = function(value) {
        if (!arguments.length) return domain;
        domain = value;
        return chart;
    }

    chart.log = function(value) {
        if (!arguments.length) return log;
        log = value;
        return chart;
    }

    chart.on_scale_change = function(value) {
        if (!arguments.length) return on_scale_change;
        on_scale_change = value;
        return chart;
    }

    chart.bins = function(value) {
        if (!arguments.length) return bins;
        bins = value;
        return chart;
    }

    chart.min_bin_width = function(value) {
        if (!arguments.length) return min_bin_width;
        min_bin_width = value;
        return chart;
    }

    chart.color_scale = function(value) {
        if (!arguments.length) return color_scale;
        color_scale = value;
        return chart;
    }

    chart.height = function(value) {
        if (!arguments.length) return height;
        height = value;
        return chart;
    }

    chart.width = function(value) {
        if (!arguments.length) return width;
        width = value;
        return chart;
    }

    chart.margin = function(value) {
        if (!arguments.length) return margin;
        for (var k in value)
            margin[k] = value[k];
        return chart;
    }
         
    chart.xlabel = function(value) {
        if (!arguments.length) return xlabel;
        xlabel = value;
        return chart;
    }

    chart.ylabel = function(value) {
        if (!arguments.length) return ylabel;
        ylabel = value;
        return chart;
    }

    return chart;
}
