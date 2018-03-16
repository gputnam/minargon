function timeSeries() {
    var margin = {top: 20, right: 25, bottom: 50, left: 50},
        width = null,
        height = 100;

    var title = '';

    var duration = 600*1e3;

    now = new Date();

    var buffer = 1000;

    function chart(selection) {
        selection.each(function(data) {

            if (width === null)
                width = $(this).width() - margin.left - margin.right;

            var x = d3.time.scale()
                .domain([now - duration, +now-buffer])
                .range([0, width]);

            var x_tick = d3.scale.linear()
                .domain([duration/1000,buffer/1000])
                .range([0,width]);

            var data_x = data.t.map(function(d) { return (new Date(d)).getTime(); }),
                data_y = data.y;

            var y = d3.scale.linear()
                .domain([d3.min(data_y),d3.max(data_y)])
                .range([height, 0]);

            var line = d3.svg.line()
                //.interpolate("basis")
                .x(function(d, i) { return x(data_x[i]); })
                .y(function(d, i) { return y(d); });

            var area = d3.svg.area()
                //.interpolate("basis")
                .x(function(d, i) { return x(data_x[i]); })
                .y0(height)
                .y1(function(d, i) { return y(d); });

            var svg = d3.select(this).selectAll('svg').data([data_y]);
                
            var genter = svg.enter().append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                //.style("margin-left", -margin.left + "px")
              .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            genter.append('text').text(title).attr('x',10)
                .attr('y',height - 10).attr('class','title');

            genter.append("defs").append("clipPath")
                .attr("id", "clip")
              .append("rect")
                .attr("width", width)
                .attr("height", height);

            genter.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .call(x.axis = d3.svg.axis().scale(x_tick).orient("bottom"));

            genter.append("g")
                .attr("class", "y axis")
                //.attr("transform", "translate(0," + height + ")")
                .call(y.axis = d3.svg.axis().scale(y).orient("left"));

            genter.append("g")
                .attr("clip-path", "url(#clip)")
              .append("path")
                .data([data_y])
                .attr("class", "line");

            genter.append("g")
                .attr("clip-path", "url(#clip)")
              .append("path")
                .data([data_y])
                .attr("class", "area");

            var g = svg.select('g');

            // redraw the line
            g.selectAll(".area").data([data_y])
                .attr("d", area)
                .transition()
                .duration(1000)
                .ease('linear')
                .attr('transform','translate(' + -x(Date.now()-duration) + ')');

            g.select('.y.axis').transition().call(y.axis = d3.svg.axis().scale(y).ticks(5).orient("left"));
            //g.select('.x.axis').transition()

            // redraw the line
            g.selectAll(".line").data([data_y])
                .attr("d", line)
                .transition()
                .duration(1000)
                .ease('linear')
                .attr('transform','translate(' + -x(Date.now()-duration) + ')');
        });
    }
    chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
    };

    chart.width = function(_) {
        if (!arguments.length) return width;
        width = _;
        return chart;
    };

    chart.height = function(_) {
        if (!arguments.length) return height;
        height = _;
        return chart;
    };

    chart.duration = function(_) {
        if (!arguments.length) return duration;
        duration = _;
        return chart;
    };

    chart.duration = function(_) {
        if (!arguments.length) return duration;
        duration = _;
        return chart;
    };

    chart.title = function(_) {
        if (!arguments.length) return title;
        title = _;
        return chart;
    };

    return chart;
}
