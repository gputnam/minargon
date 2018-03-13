function createArray(length) {
    var arr = new Array(length || 0),
        i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = createArray.apply(this, args);
    }

    return arr;
}

var crate_setup = createArray(20,32,16);

for (var i=0; i < 20; i++) {
    for (var j=0; j < 32; j++) {
        for (var k=0; k < 16; k++) {
            crate_setup[i][31-j][k] = (i << 9) | (k << 5) | j;
        }
    }
}

function card_view() {
    var svg;
    var crate = 0;
    var threshold = null;

    var click = function(d, i) { return; };

    var scale = d3.scale.threshold().domain([100]).range(['#bababa','#ca0020']);

    var format = d3.format('.0f');

    function chart(selection) {
        selection.each(function(data) {
            var table = d3.select(this).selectAll('table').data([crate], function(d) { return d; });
            table.exit().remove();
            table.enter().append('table');

            var setup = crate_setup[crate];

            var tr2 = table.selectAll('tr')
                .data(setup)
                .enter().append('tr')
                .attr('id', function(d, i) { return 'card-' + i; });

            //table.insert('tr',':first-child').selectAll('td').data(d3.range(17)).enter().append('td')
            //  .text(function(d, i) {
            //    if (i) {
            //      return i-1;
            //    } else {
            //      return '';
            //    }
            //  })
            //  .attr('class','card-label-col');

            var td = tr2.selectAll('td')
                .data(function(d) { return d; }, function(d) { return d; })
                .enter().append('td')
                .on('click', click)
                .attr('id','channel')
                .attr('style','background-color:#e0e0e0')
                .attr('title', function(d) {
                    return 'Card ' + ((d >> 5) & 0xf) + ', Channel ' + (d & 0x1f);});

            //tr2.insert('td',':first-child').text(function(d, i) { return 31-i; })
            //  .attr('class','card-label-row');

            var select = d3.select(this).selectAll('#channel');

            select.attr('style', function(k, i) {
                var v = data[k];
                if (v === null || typeof v === 'undefined' || v === 0)
                    return 'background-color:#e0e0e0';
                else
                    return 'background-color:' + scale(+v);
            })
            .text(function(k, i) { 
                var v = data[k];
                if (v === null || typeof v === 'undefined')
                    return '';
                else
                    return format(+v);
            });
           });}

   chart.crate = function(value) {
       if (!arguments.length) return crate;
       crate = value;
       return chart;
   }

   chart.scale = function(value) {
       if (!arguments.length) return scale;
       scale = value;
       return chart;
   }

    chart.click = function(value) {
        if (!arguments.length) return click;
        click = value;
        return chart;
    }

   chart.threshold = function(value) {
       if (!arguments.length) return threshold;
       threshold = value;
       scale = d3.scale.threshold().domain([threshold]).range(['#bababa','#ca0020']);
       return chart;
   }

   chart.format = function(value) {
       if (!arguments.length) return format;
       format = value;
       return chart;
   }
   return chart;
}

function crate_view() {
    var margin = {top: 20, right: 25, bottom: 50, left: 25},
        width = null,
        height = null;

    var threshold = null;

    var svg;

    var click = function(d, i) { return; };

    var caption = true;

    var hover_text = false;

    var scale = d3.scale.threshold().domain([100]).range(['#bababa','#ca0020']);

    function MakeStylingFunction(){
        var attribute = 'style';
        var coloringFunction = function(data) {
            return function(k, i) {
                var v = data[k];
                if (v === null || typeof v === 'undefined' || v === 0) {
                    return 'background-color:#e0e0e0';
                }
                else {
                    return 'background-color:' + scale(+v);
        }};}
        function stylingFunction(node,data) {
                node.attr(attribute,coloringFunction(data));
        }

        stylingFunction.attribute = function(value) {
            if(!arguments.length) return attribute;
            attribute = value;
            return stylingFunction;
        }
        stylingFunction.coloringFunction = function(value) {
            if(!arguments.length) return coloringFunction;
            coloringFunction = value;
            return stylingFunction;
        }
        return stylingFunction;
    }
    var stylingFunction = MakeStylingFunction();

    function chart(selection) {
        selection.each(function(data) {
        if (width === null)
            width = $(this).width() - margin.left - margin.right;

        if (height === null)
            height = Math.round(width/1.6) - margin.top - margin.bottom;

        var root = d3.select(this).selectAll('div').data([1]);

        var table = root.enter().append('div').attr('id','crate-view');

        var tr1 = table.selectAll('div')
            .data(crate_setup)
            .enter()
          .append('div')
            .on('click', click)
            .attr('style','display:inline-block')
            .attr("id", function(d, i) { return "crate" + i;})
            .attr("class", function(d, i) { return "crate" + i;})
          .append('table')
            .attr('style','padding:2px;border-collapse:separate;border-spacing:1px')

        if (caption) {
            tr1.insert('caption').text(function(d, i) { return i; })
        }

        var tr2 = tr1.selectAll('tr')
            .data(function(d) { return d; })
            .enter().append('tr');

        var td = tr2.selectAll('td')
            .data(function(d) { return d; }, function(d) { return d; })
            .enter().append('td');
        if(hover_text){
            if(typeof hover_text === "function"){
                td.attr('title',hover_text(data));
            }
            else{
                td.attr('title',hover_text);
            }
        }
        else{
            tr1.attr('title', function(d, i) { return 'Crate ' + i; });
        }

        var select = d3.select(this).selectAll('#crate-view div table tr td')

        stylingFunction(select,data);
    });}

    chart.height = function(value) {
        if (!arguments.length) return height;
        height = value;
        return chart;
    }

    chart.scale = function(value) {
        if (!arguments.length) return scale;
        scale = value;
        return chart;
    }

    chart.caption = function(value) {
        if (!arguments.length) return caption;
        caption = value;
        return chart;
    }

    chart.width = function(value) {
        if (!arguments.length) return width;
        width = value;
        return chart;
    }

    chart.click = function(value) {
        if (!arguments.length) return click;
        click = value;
        return chart;
    }

    chart.threshold = function(value) {
        if (!arguments.length) return threshold;
        threshold = value;
        scale = d3.scale.threshold().domain([threshold]).range(['#bababa','#ca0020']);
        return chart;
    }

    chart.stylingFunction = function(value) {
        if(!arguments.length) {return stylingFunction;}
        stylingFunction = value;
        return chart;
    }

    chart.hover_text = function(value) {
        if(!arguments.length) {return hover_text;}
        hover_text = value;
        return chart;
    }

    return chart;
}
