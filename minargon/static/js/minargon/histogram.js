// requires pltoly loaded
class Histogram {
    constructor(n_data, target, layout) {
        this.data = new Array(n_data);
        this.target = target;
        this.draw(layout);
    }

    draw(layout) {
        Plotly.newPlot(this.target, [this.trace()], layout);
    }

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
