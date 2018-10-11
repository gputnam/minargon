class TimeSeries {
  constructor(config, href) {
    this.config = config;
    this.href = href;
  }

  field_data_list(metric) {
    var ret = [];
    for (var i = 0; i < this.config.fields.length; i++) {
      // get the name of the data link constructor
      var Fconstructor = this.config.data_link;
      ret.push(window[Fconstructor](metric, this.config.instance, this.config.fields[i]));
    }
    return ret;
  }

  metric_data_list(field_index, metric_list) {
    var ret = [];
    var Fconstructor = this.config.data_link;
    for (var i = 0; i < this.config.metric_list.length; i++) {
      var metric = this.config.metrics[this.config.metric_list[i]];
      var add = true;
      if (metric_list !== undefined && metric_list.indexOf(metric) < 0) {
        add = false;
      } 

      if (add) {
        ret.push(window[Fconstructor](metric, this.config.instance, this.config.fields[field_index]));
      }
    }
    return ret;
  }

  // collect default parameters from metric
  default_param(metric) {
    return this.config.metrics[metric];
  }

  getLink(index) {
    if (!(this.href === undefined)) {
        return this.href(this.config.instance, this.config.fields[index]);
    }
    return undefined;
  }

}

class CubismMultiMetricController {
  constructor(target, timeseries_config, field_index, height) {
    this.target = target;
    this.timeseries = new TimeSeries(timeseries_config);
    this.height = height;
    this.field_index = field_index;

    this.context = create_cubism_context(target, this.timeseries);
  }
  heightController(id) {
    var self = this;
    $(id).change(function() { self.updateHeight(this.value); });
    return this;
  }
  stepController(id) {
    var self = this;
    $(id).change(function() {self.updateStep(this.value);});
    return this;
  }
  metrics(metric_list) {
    this.metric_list = metric_list;
    return this;
  }
 
  updateStep(input) {
    this.context.step(input);
    // remake the data
    this.updateData(true);
  }

  updateHeight(input) {
    this.height = input;

    // redraw horizons
    var data = d3.select(this.target).selectAll('.horizon').data();
    delete_horizons(this);
    make_horizons(this, data);

  }
 
  updateData(remove_old) {
    if (remove_old === true)
      delete_horizons(this);
      
    var data_links = this.timeseries.metric_data_list(this.field_index, this.metric_list);
    var ret = add_metrics(this, data_links, false);
    return ret;
  }

}

// class for controlling parameters of cubism context
class CubismController {
  constructor(target, timeseries_config, metric, height) {
    this.target = target;

    this.timeseries = new TimeSeries(timeseries_config);
    this.context = create_cubism_context(target, this.timeseries);

    this.height = height;
    this.metric = metric;
    this.target = target;

    this.range = [];
  }


  set() {
    this.metricParam();
    return this;
  }

  linkFunction(Fhref) {
    this.timeseries.href = Fhref;
    return this;
  }
 
  metricController(id) {
    var self = this;
    $(id).change(function() { self.updateMetric(this.value); });
    return this;
  }
  heightController(id) {
    var self = this;
    $(id).change(function() { self.updateParam(this.value, "height"); });
    return this;
  }
  rangeController(id_lo, id_hi, update_on_metric_change) {
    var self = this;

    $(id_lo).keypress(function(e) {
      if (e.which == 13) {
        self.updateParam(this.value, "range-lo");
      }
    });
    $(id_hi).keypress(function(e) {
      if (e.which == 13) {
        self.updateParam(this.value, "range-hi");
      }
    });

    if (!(update_on_metric_change === false)) {
        this.range_lo_controller = id_lo;
        this.range_hi_controller = id_hi;
    }
    return this;
  }
  stepController(id) {
    var self = this;
    $(id).change(function() {self.updateStep(this.value);});
    return this;
  }

  onClick(stream_name, index) {
    // check if link function is defined
    var link = this.timeseries.getLink(index);
    if (!(link === undefined)) {
        // go there
        window.location.href = $SCRIPT_ROOT + "/" + link;
    }
  }

  metricParam() {
    var metric_param = this.timeseries.default_param(this.metric);
    if (!(metric_param.range === undefined)) {
      this.range = metric_param.range; 
    }
    else {
      this.range = [];
    }

    this.format = metric_param.format;
    // set in range values
    if (!(this.range_lo_controller === undefined)) {
      if (this.range.length != 0) {
        $(this.range_lo_controller).val(this.range[0]);
      }
      else { 
       $(this.range_lo_controller).val("");
     }
    } 
    if (!(this.range_hi_controller === undefined)) {
      if (this.range.length != 0) {
        $(this.range_hi_controller).val(this.range[1]);
      }
      else {
        $(this.range_hi_controller).val("");
      }
    }
  }

  updateMetric(metric) {
    this.metric = metric;
    this.metricParam();
    this.updateData(true);
  } 

  updateStep(input) {
    this.context.step(input);
    // remake the data
    this.updateData(true);
  }

  updateParam(input, param_name) {
    // update this param
    if (param_name == "height") this.height = input;
    else if (param_name == "range-hi") this.range[1] = input;
    else if (param_name == "range-lo") this.range[0] = input;
    // if no valid update, just return
    else return;

    // redraw horizons
    var data = d3.select(this.target).selectAll('.horizon').data();
    delete_horizons(this);
    make_horizons(this, data);
  }

  updateData(remove_old) {
    if (remove_old === true) {
        delete_horizons(this);
    }
    var data_links = this.timeseries.field_data_list(this.metric); 
    var ret = add_metrics(this, data_links, true);
    return ret;
  }

}

// add in metrics w/ a horizon chart to the provided target
function add_metrics(controller, data_links, use_field_name) {
  // add new metrics
  var data = data_links.map(function(data_link, i) { 
    // use the field name or the metric name
    if (use_field_name) {
      var metric = controller.context.metric(data_link.get_values.bind(data_link), controller.timeseries.config.fields[i].name);
    }
    else {
      var metric = controller.context.metric(data_link.get_values.bind(data_link), controller.timeseries.config.metric_list[i]);
    }
    //metric.on("change", function(start, stop) {});
    return metric;
  });
    return make_horizons(controller, data);
}

// make new horizon objects
function make_horizons(controller, data) {
  var horizon = controller.context.horizon();
  horizon = horizon.height(controller.height);
  if (controller.range !== undefined && controller.range.length != 0) { 
    horizon = horizon.extent(controller.range);
  }
  if (!(controller.format === undefined)) {
    horizon = horizon.format(controller.format);
  }
  var horizons = d3.select(controller.target).selectAll('.horizon')
      .data(data)
      .enter().insert("div", ".bottom")
      .attr("class", "horizon")
      .call(horizon);
  if (!(controller.onClick == undefined)) {
    horizons.on("click", controller.onClick.bind(controller));
  }
  return horizons;
}

// delete the horizons and the associated metrics
function delete_horizons(controller) {
  d3.select(controller.target).selectAll('.horizon')
      .call(controller.context.horizon().remove)
      .remove();
}

function create_cubism_context(target, timeseries) {
    var step = timeseries.config.steps[0];
    var size = $(target).width();
    var context = cubism.context()
        .serverDelay(timeseries.config.server_delay)
        .step(step*1000)
        .size(size); 

    // delete old axes
    $(target + ' .axis').remove();

    // add time axes
    d3.select(target).selectAll(".axis")
        .data(["top", "bottom"])
      .enter().append("div")
        .attr("class", function(d) { return d + " axis"; })
        .each(function(d) {
            var axis = context.axis()
                .ticks(12)
                .orient(d);
                //.focusFormat(focus_format);
            d3.select(this).call(axis);
        });

    // delete old rule
    $(target + ' .rule').remove();

    d3.select(target).append("div")
        .attr("class", "rule")
        .call(context.rule());    

    return context;
}

