// requires pltoly loaded
class Histogram {
    constructor(n_data, target) {
        this.data = new Array(n_data);
        this.target = target;
        this.initialized = false;
    }

    draw() {
        Plotly.newPlot(this.target, [this.trace()]);
    }

    trace() {
        return {
            x: this.data,
            type: "histogram",
        };
    }

    updateData(data) {
        for (var i = 0; i < this.data.length; i ++) {
            this.data[i] = data[i];
        }
        if (this.initialized == true) {
            this.redraw();
        }
        else {
            this.draw();
            this.initialized = true;
        }
    }

    redraw() {
         Plotly.redraw(this.target);
    }

}
