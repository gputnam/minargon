// requires pltoly loaded
// class managing a plotly histogram
class Histogram {
    // target: the id of the div to be drawn in
    // layout: the layout of the plotly histogram (as defined in plotly)
    constructor(n_data, target, layout) {
        this.data = new Array(n_data);
        this.target = target;
        this.draw(layout);
    }
   
    draw(layout) {
        Plotly.newPlot(this.target, [this.trace()], layout);
    }

    // update plot with a new layout
    reLayout(layout) {
        Plotly.relayout(this.target, layout);
    }

    trace() {
        var ret = {
            x: this.data,
            type: "histogram",
        };
        return ret;
    }

    // update the data and redraw the plot
    // data: an array of size n_data
    updateData(data) {
        for (var i = 0; i < this.data.length; i ++) {
            this.data[i] = data[i];
        }
        this.redraw();
    }

    redraw() {
         Plotly.redraw(this.target);
    }
}

// also requires plotly loaded
// a class managing a plotly line chart
class LineChart {
    // target: the id of the div to be drawn in
    // layout: the layout of the plotly histogram (as defined in plotly)
    constructor(n_data, target, layout) {
        this.data = new Array(n_data);
        this.n_data = n_data;
        this.target = target;
        this.draw(layout);
    }

    draw(layout) {
        Plotly.newPlot(this.target, [this.trace()], layout);
    }

    // update plot with a new layout
    reLayout(layout) {
        Plotly.relayout(this.target, layout);
    }

    trace() {
        var x = [];
        for (var i = 0; i < this.n_data; i++) {
            x.push(i);
        }
        var ret = {
            x: x,
            y: this.data,
            type: "scatter",
        };
        return ret;
    }

    // update the data and redraw the plot
    // data: an array of size n_data
    updateData(data) {
        for (var i = 0; i < this.data.length; i ++) {
            this.data[i] = data[i];
        }
        this.redraw();
    }

    redraw() {
         Plotly.redraw(this.target);
    }


}

