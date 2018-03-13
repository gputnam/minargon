function linspace(min, max, N) {
    var a = [];
    for (var i=0; i < N; i++) {
        a[i] = min + (max-min)*i/(N-1);
    }
    return a;
}

var xsnoed1 = ["#4876ff","#32cd32","#ffff00","#ffa500","#ff0000"],
    xsnoed2 = ["#3a5fcd","#2e8b57","#cd9b1d","#ffa500","#ff0000"];

var color_scales = {};
color_scales.xsnoed1 = xsnoed1;
color_scales.xsnoed2 = xsnoed2;
for (var key in colorbrewer) {
    color_scales[key] = colorbrewer[key][5];
}

color_scales = d3.entries(color_scales);

function change_color_scale() {
    chart.color_scale().range(color_scales[this.selectedIndex].value);
    redraw();
}

var color_menu = d3.select("#color-scale-menu")
    .on("change", change_color_scale);

color_menu.selectAll("option")
    .data(color_scales)
  .enter().append("option")
    .text(function(d) { return d.key; });

color_menu.property("selectedIndex", 12);

var color_scale = d3.scale.linear()
    .domain(linspace(0,1e-3,5))
    .range(color_scales[12].value);

var chart = histogram()
    .on_scale_change(redraw)
    .color_scale(color_scale)
    .bins(50)
    .domain([0,0.01]);

var crate = crate_view().caption(false).scale(color_scale);

var element = $('#hero');
var width   = element.width();
var height  = width/2.0;

var svg = d3.select('#hero').append("svg")
    .attr("width", width)
    .attr("height", height);

var options = [
{name: "Aitoff", projection: d3.geo.aitoff()},
{name: "Albers", projection: d3.geo.albers().scale(145).parallels([20, 50])},
{name: "August", projection: d3.geo.august().scale(60)},
{name: "Baker", projection: d3.geo.baker().scale(100)},
{name: "Boggs", projection: d3.geo.boggs()},
{name: "Bonne", projection: d3.geo.bonne().scale(120)},
{name: "Bromley", projection: d3.geo.bromley()},
{name: "Collignon", projection: d3.geo.collignon().scale(93)},
{name: "Craster Parabolic", projection: d3.geo.craster()},
{name: "Eckert I", projection: d3.geo.eckert1().scale(165)},
{name: "Eckert II", projection: d3.geo.eckert2().scale(165)},
{name: "Eckert III", projection: d3.geo.eckert3().scale(180)},
{name: "Eckert IV", projection: d3.geo.eckert4().scale(180)},
{name: "Eckert V", projection: d3.geo.eckert5().scale(170)},
{name: "Eckert VI", projection: d3.geo.eckert6().scale(170)},
{name: "Eisenlohr", projection: d3.geo.eisenlohr().scale(60)},
{name: "Equirectangular (Plate Carrée)", projection: d3.geo.equirectangular()},
{name: "Hammer", projection: d3.geo.hammer().scale(165)},
{name: "Hill", projection: d3.geo.hill()},
{name: "Goode Homolosine", projection: d3.geo.homolosine()},
{name: "Kavrayskiy VII", projection: d3.geo.kavrayskiy7()},
{name: "Lambert cylindrical equal-area", projection: d3.geo.cylindricalEqualArea()},
{name: "Lagrange", projection: d3.geo.lagrange().scale(120)},
{name: "Larrivée", projection: d3.geo.larrivee().scale(95)},
{name: "Laskowski", projection: d3.geo.laskowski().scale(120)},
{name: "Loximuthal", projection: d3.geo.loximuthal()},
{name: "Mercator", projection: d3.geo.mercator().scale(490 / 2 / Math.PI)},
{name: "Miller", projection: d3.geo.miller().scale(100)},
{name: "McBryde–Thomas Flat-Polar Parabolic", projection: d3.geo.mtFlatPolarParabolic()},
{name: "McBryde–Thomas Flat-Polar Quartic", projection: d3.geo.mtFlatPolarQuartic()},
{name: "McBryde–Thomas Flat-Polar Sinusoidal", projection: d3.geo.mtFlatPolarSinusoidal()},
{name: "Mollweide", projection: d3.geo.mollweide().scale(165)},
{name: "Natural Earth", projection: d3.geo.naturalEarth()},
{name: "Nell–Hammer", projection: d3.geo.nellHammer()},
{name: "Polyconic", projection: d3.geo.polyconic().scale(100)},
{name: "Robinson", projection: d3.geo.robinson()},
{name: "Sinusoidal", projection: d3.geo.sinusoidal()},
{name: "Sinu-Mollweide", projection: d3.geo.sinuMollweide()},
{name: "van der Grinten", projection: d3.geo.vanDerGrinten().scale(75)},
{name: "van der Grinten IV", projection: d3.geo.vanDerGrinten4().scale(120)},
{name: "Wagner IV", projection: d3.geo.wagner4()},
{name: "Wagner VI", projection: d3.geo.wagner6()},
{name: "Wagner VII", projection: d3.geo.wagner7()},
{name: "Winkel Tripel", projection: d3.geo.winkel3()}
];

options.forEach(function(o) {
    o.projection.rotate([0, 0]).center([0, 0])
        .scale((width + 1) / 2 / Math.PI)
        .translate([width / 2, height / 2])
        .precision(0.1);
    });

var coords = [];
for (var i=0; i < pmtinfo['x'].length; i++) {
    var x = pmtinfo.x[i],
        y = pmtinfo.y[i],
        z = pmtinfo.z[i];

    var r = Math.sqrt(x*x + y*y + z*z);

    var theta = -(Math.acos(z/r)*180.0/Math.PI - 90.0);
    var phi   = Math.atan2(y,x)*180.0/Math.PI;

    coords[i] = [phi, theta];
}

var projection = options[16].projection;

var menu = d3.select("#projection-menu")
    .on("change", function() { update_projection(options[this.selectedIndex]); });

menu.selectAll("option")
    .data(options)
  .enter().append("option")
    .text(function(d) { return d.name; });

menu.property("selectedIndex", 16);

function update_projection(option) {
    svg.selectAll("path").transition()
        .duration(1000)
        .attrTween("d", projectionTween(projection, projection = option.projection));

    projection = option.projection;

    for (var i=0; i < coords.length; i++)
        pos[i] = projection(coords[i]);

    svg.selectAll('circle')
        .transition().duration(1000)
        .attr('cx',function(d, i) { return pos[i][0]; })
        .attr('cy',function(d, i) { return pos[i][1]; });
}

function projectionTween(projection0, projection1) {
    return function(d) {
        var t = 0;

        var projection = d3.geo.projection(project)
            .scale(1)
            .translate([width / 2, height / 2]);

        var path = d3.geo.path()
            .projection(projection);

        function project(λ, φ) {
            λ *= 180 / Math.PI, φ *= 180 / Math.PI;
            var p0 = projection0([λ, φ]), p1 = projection1([λ, φ]);
            return [(1 - t) * p0[0] + t * p1[0], (1 - t) * -p0[1] + t * -p1[1]];
        }

        return function(_) {
            t = _;
            return path(d);
        };
    };
}

function redraw() {
    d3.select("#hist").call(chart);
    d3.select("#crate").call(crate);

    svg.selectAll("circle")
        .style('fill',function(d, i) { return d ? color_scale(d) : "#e0e0e0";});
 
}

function setup() {
    // set up projection
    var path = d3.geo.path().projection(projection);

    var graticule = d3.geo.graticule();

    svg.append("path")
        .datum(graticule)
        .attr("class", "graticule")
        .attr("d", path);

    d3.select(self.frameElement).style("height", height + "px");

    pos = [];
    for (var i=0; i < coords.length; i++)
        pos[i] = projection(coords[i]);

    svg.selectAll('circle').data(pos)
      .enter().append('circle')
        .style('fill', '#e0e0e0')
        .attr('cx', function(d) { return d ? d[0]: null; })
        .attr('cy', function(d) { return d ? d[1]: null; })
        .attr('r', 2);

    // set up histogram
    d3.select('#hist').datum([]).call(chart);

    // collapse histogram panel
    $('#collapseOne').collapse();

    // set up crate view
    d3.select("#crate").datum([]).call(crate);
    // line break after crate 9 to get
    // XSNOED style
    $("#crate9").after("<br>");
}

function update(result) {
    $.getJSON($SCRIPT_ROOT + '/query', { name: 'occupancy' }).done(function(result) {
        values = result.values;

        d3.select('#hist').datum(values);

        svg.selectAll('circle').data(values);

        d3.select('#crate').datum(values);

        redraw();

        setTimeout(update,10000);
    });
}
