function bar_chart() {
    var margin = {top: 20, right: 25, bottom: 50, left: 25},
        width = null,
        height = null;

    var svg;

    var xlabel = '',
        ylabel = '';

    var xrange = null,
        yrange = null;

    var mouse_down = null,
        xdownrange = null,
        ydownrange = null;

    var click = function(d, i) { return; };
    var click_bg = function() { return; };

    var layout = d3.entries;

    function chart(selection) {
        selection.each(function(data) {

        data = layout(data, this);

        if (width === null)
            width = $(this).width() - margin.left - margin.right;

        if (height === null)
            height = Math.round(width/1.6) - margin.top - margin.bottom;

        var data_x = data.map(function(d) { return d.key || d.x; }),
            data_y = data.map(function(d) { return d.value || d.y; });

        if (xrange == null)
            xrange = [0,width];

        if (yrange == null)
            yrange = [height,0];

        var x = d3.scale.ordinal()
            .rangeRoundBands(xrange,0.1)
            .domain(data_x);

        var y = d3.scale.linear()
            .range(yrange)
            .domain([0,d3.max(data_y)]);

        var x_axis = d3.svg.axis().scale(x).orient('bottom');
        var y_axis = d3.svg.axis().scale(y).orient('left');

        if (y.domain()[1] > 100)
            y_axis.tickFormat(d3.format('.2s'));

	svg = d3.select(this).selectAll('svg').data([data]);
	
	var genter = svg.enter().append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
                .attr('pointer-events','all')
              .append('g')
                .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        var element = this;

        var bg = genter.append('rect')
            .attr('fill', 'white')
            .attr('width', width)
            .attr('height', height)
            .on('click', click_bg);

        genter.append('g').attr('class', 'x axis').attr('id','x-axis')
            .attr('transform', 'translate(0,' + height + ')')
            .call(x_axis);

        genter.append('g').attr('class', 'y axis').attr('id','y-axis')
            .call(y_axis);

        genter.selectAll('rect,#x-axis,#y-axis')
            .on('mousedown', function(d) { 
                down_mouse = d3.mouse(element);
                xdownrange = xrange;
                ydownrange = yrange;

                var id = this.id;

                d3.event.preventDefault();

                d3.select(window).on('mousemove', function(d) {
                    if (xdownrange !== null) {
                        var mouse = d3.mouse(element);
                        var dx = mouse[0] - down_mouse[0];
                        var dy = mouse[1] - down_mouse[1];
                        if (id == 'x-axis') {
                            xrange[1] = xdownrange[1] + dx;
                        } else if (id == 'y-axis') {
                            yrange[1] = ydownrange[1] + dy;
                        } else {
                            xrange = [xdownrange[0] + dx, xdownrange[1] + dx];
                            yrange = [ydownrange[0] + dy, ydownrange[1] + dy];
                        }
                        draw();
                    }
                    d3.event.preventDefault();
                    })
                    .on('mouseup', function(d) {
                        if (xdownrange !== null) {
                            var mouse = d3.mouse(element);
                            var dx = mouse[0] - down_mouse[0];
                            var dy = mouse[1] - down_mouse[1];
                            if (id == 'x-axis') {
                                xrange[1] = xdownrange[1] + dx;
                            } else if (id == 'y-axis') {
                                yrange[1] = ydownrange[1] + dy;
                            } else {
                                xrange = [xdownrange[0] + dx, xdownrange[1] + dx];
                                yrange = [ydownrange[0] + dy, ydownrange[1] + dy];
                            }
                            draw();
                        }
                        xdownrange = null;
                        d3.select(window).on('mouseup',null);
                        d3.select(window).on('mousemove',null);
                    });
            });

        genter.append('text')
            .attr('class', 'x label')
            .attr('text-anchor', 'middle')
            .attr('x', width/2)
            .attr('y', height + margin.bottom)
            .text(xlabel);

        genter.append('text')
            .attr('class', 'y label')
            .attr('text-anchor', 'end')
            .attr('y', 6)
            .attr('dy', '.75em')
            .attr('transform', 'rotate(-90)')
            .text(ylabel);

        function draw() {
            x.rangeRoundBands(xrange,0.1);
            y.range(yrange);

            var g = svg.select('g')

            g.select('.x.axis').transition().call(x_axis);
            g.select('.y.axis').transition().call(y_axis);

            g.select('.x.label').transition().text(xlabel);
            g.select('.y.label').transition().text(ylabel);

            var bars = g.selectAll('.bar')
                .data(data_x);

            bars.enter().append('rect')
                .attr('class', 'bar')
                .attr('x', width)
                .attr('width', x.rangeBand())
                .attr('y', function(d, i) { return y(data_y[i]); })
                .attr('height', function(d, i) { return height - y(data_y[i]); })
                .style({opacity: 1})
                .on('click', click);

            bars.transition()
                .attr('x', function(d, i) { return x(data_x[i]); })
                .attr('width', x.rangeBand())
                .attr('y', function(d, i) { return y(data_y[i]); })
                .attr('height', function(d, i) { return height - y(data_y[i]); });

                bars.exit().transition().style({opacity: 0}).remove();
            }
            draw();

        });}

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
             

        chart.click = function(value) {
            if (!arguments.length) return click;
            click = value;
            return chart;
        }

        chart.click_bg = function(value) {
            if (!arguments.length) return click_bg;
            click_bg = value;
            return chart;
        }

        chart.layout = function(value) {
            if (!arguments.length) return layout;
            layout = value;
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

function histogram_chart() {
    var chart = bar_chart().layout(d3.layout.histogram());
    return chart;
}
