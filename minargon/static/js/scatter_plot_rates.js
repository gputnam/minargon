si_format = d3.format('.3s');

function my_si_format(d) {
    if (!$.isNumeric(d))
        return '-';
    else
        return si_format(d);
}


function history() {
    var params = {}
    params['crate'] = document.getElementById("crate-sel").value;
    params['slot'] = document.getElementById("slot-sel").value;
    params['channel'] = document.getElementById("channel-sel").value;
    try{
        params['yscale'] = document.getElementById("yscale").value;
    }
    catch (e) {
        params['yscale'] = 'Linear';
    }
    try{
        params['starting_run'] = document.getElementById("starting_run").value;
    }
    catch (e) {
        params['starting_run'] = 103214;
    }
    window.location.replace($SCRIPT_ROOT + "/check_rates_history?" + $.param(params));
}

function draw_scatter_plot(){
    var data = window.data;
    var yscale = document.getElementById("yscale").value;
    var start = document.getElementById("starting_run").value;
    if( data != undefined && data != "" ){
        var end = d3.max(data, function(d) { return d[0]; }) + 1;

        var margin = {top: 10, right: 80, bottom: 80, left: 120}
            ,width = $("#main").width() - margin.left - margin.right
            ,height = 400;

        // Xrange starts when the we started storing cmos data
        var x = d3.scale.linear()
            .domain([start, end])
            .range([ 0, width ]);

        var ymin = d3.max([0, d3.min(data, function(d) { return d[1]; })]);
        var ypad = ymin*0.1;
        var ymax = d3.max(data, function(d) { return d[1]; });
        var yppad = ymax*0.1;

        var y;
        var tolerance;
        if(yscale == "Linear") {
             tolerance = 0.0;
             y = d3.scale.linear()
                 .domain([ymin-ypad, ymax+ypad])
                 .range([height, 0]);
        }
        if(yscale == "Log") {
             tolerance = 0.001; /* protect against log(0) */
             y = d3.scale.log()
                 .domain([ymin/2+tolerance, ymax*1.25])
                 .range([height, 0]);
        }

        var chart = d3.select('#main')
            .append('svg:svg')
            .attr('width', width + margin.right + margin.left)
            .attr('height', height + margin.top + margin.bottom)
            .attr('class', 'chart');

        var valueline = d3.svg.line()
            .x(function(d) { return x(d[0]); })
            .y(function(d) { return y(d[1]+tolerance); });

        var main = chart.append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
            .attr('width', width)
            .attr('height', height)
            .attr('class', 'main');

        var div = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        // draw the x axis
        var xAxis = d3.svg.axis()
            .scale(x)
            .orient('bottom')
            .tickSize(6)
            .ticks(6);

        main.append('g')
            .attr('transform', 'translate(0,' + height + ')')
            .attr('class', 'main axis date')
            .call(xAxis)
            .selectAll("text")
              .attr("x", 6)
              .attr("dy", "1.2em");

        // draw the y axis
        var yAxis = d3.svg.axis()
            .scale(y)
            .orient('left')
            .tickSize(6)
            .ticks(8, "s");

        main.append('g')
            .attr('transform', 'translate(0,0)')
            .attr('class', 'main axis')
            .call(yAxis);

        d3.selectAll(".tick > text")
            .style("font-size", "18px");

        var g = main.append("svg:g");

        g.append("path")
            .data([data])
            .attr("class", "line")
            .attr("d", valueline);

        g.selectAll("scatter-dots")
            .data(data)
            .enter().append("svg:circle")
                .attr("cx", function (d,i) { return x(d[0]); } )
                .attr("cy", function (d) { return y(d[1]+tolerance); } )
                .attr("r", 8)
                .on("mouseover", function(d) {      
                    div.transition()        
                        .duration(200) 
                        .style("opacity", .9);      
                    div .html("(" + (d[0]) + ","  + my_si_format(d[1]) + ")")  
                        .style("left", (d3.event.pageX) + "px")
                        .style("top", (d3.event.pageY - 28) + "px");
                    })                  
                .on("mouseout", function(d) {
                    div.transition()
                        .duration(500)
                        .style("opacity", 0);   
                });

        chart.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
        .append("text")
            .attr("class", "label")
            .attr("x", width )
            .attr("y", 80)
            .style("text-anchor", "end")
            .text("Run Number")
            .style("font-size", "22px");

        chart.append("g")
            .attr("class", "y axis")
          .append("text")
            .attr("class", "label")
            .attr("transform", "rotate(-90)")
            .attr("dy", "2.0em")
            .style("text-anchor", "end")
            .text("CMOS Rate (Hz)")
            .style("font-size", "22px");
    }
}

