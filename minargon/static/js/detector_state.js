function flattenArray(arr) {
    return [].concat.apply([],arr);
}
function linspace(min, max, N) {
    var a = [];
    for (var i=0; i < N; i++) {
        a[i] = min + (max-min)*i/(N-1);
    }
    return a;
}
function display_binary_crate_view(key,crates_data,sizeinfo,node) //has the crate, channel, card info. in crates_datat
{
    var coloringFunc = function(data) {
        return function(k,i) {
        var v = data[k];
        if (v === null || typeof v === 'undefined')
            return 'unknown';
        else if (v===0 || !v) {
            return 'off';
        }
        else
            return 'on';
    };}

    hover_text_func = function(data) {
    return function(d,i) {
        v = data[d];
        d= d % 32; //ex: 511 (fills crate) % 32 = 31 and 9727 (fills all on/off crates/trig) % 32 = 31
        if(v == null){
            return "Unknown/Crate Off";
        }
        else if(v ==0){
            return String(i+" / "+d+" off"); //format of crate, card, channel reading (crate 0 card 1 channel 1: 0/1/1)
        }
        return String(i+" / "+d+" on");

    }};

    display_crate_view(key,crates_data,sizeinfo,node,
            {'attrib':'class','func':coloringFunc},hover_text_func);
}

function get_colors() {
    var color_scales = {};
    for (var key in colorbrewer) {
        color_scales[key] = colorbrewer[key][5];
    }
    return d3.entries(color_scales);
}

function create_hover_text_color_bar(key,node,colors)
{
    var draw_bar = function(colors) {
        percents = linspace(0,100,colors.length);
        var draw_node = node.append('div')
                .style("display",'inline')
                .attr('class','color-bar');
        help_ico = draw_node.append('div')
            .attr('class',"glyphicon glyphicon-info-sign")
            .attr('title', "Color scale 0 - 255");
        var svg = draw_node.append('svg').attr("height",20);
        var linearGradient = svg.append('linearGradient')
            .attr('id', key+'-linear-gradient');
        linearGradient
            .attr('x1', '0%')
            .attr('x2', '100%')
        for(var i=0; i<colors.length;i++)
        {
        linearGradient.append('stop')
            .attr('offset',percents[i]+'%')
            .attr('stop-color', colors[i]);
        }
        var bar = svg.append("rect")
            .attr('x','10px')
            .attr("width", '95%')
            .attr("height", '100%')
            .style("fill", "url(#"+key+"-linear-gradient)")
            .attr('rx',6)
            .attr('ry',6)
            .attr('opacity',0)
        help_ico.on('mouseover',function() {
            bar.transition().duration(1000).attr('opacity',1)});
        help_ico.on('mouseout',function() {
            bar.transition().duration(1000).attr('opacity',0)});
    }

    draw_bar(colors);
    var redraw = function(new_colors) {
        node.select(".color-bar").remove();
        draw_bar(new_colors);
    }
    return redraw;
}

function display_colorable_continuous_crate_view(key,crates_data,sizeinfo,node,bar_node)
{
    node = node.append("div").attr("class","colorable_crate");
    color_menu = node.append("select")
        .attr("id","color-scale-menu")
        .attr('class','pull-right');

    var color_scales = get_colors()

    color_menu.selectAll("option")
        .data(color_scales)
      .enter().append("option")
        .text(function(d) { return d.key; });
    default_index = 2;
    var default_color_scale = color_scales[default_index].value;
    color_menu.property("selectedIndex", default_index);

    var bar_redraw = create_hover_text_color_bar(key, bar_node,default_color_scale);

    var redraw = display_continuous_crate_view(key,crates_data,sizeinfo,default_color_scale,node);

    function change_color_scale() {
        scale = color_scales[this.selectedIndex].value;
        redraw(scale);
        bar_redraw(scale);
    }
    color_menu.on("change", change_color_scale);
}

function display_continuous_crate_view(key,crates_data,sizeinfo,color_scale,node)
{
    // This function draws a crate view at the given node and returns
    // a function that will re-draw view for different colors.
    //
    // For now this just assumes a linear scale from 0-255.
    // May have to generalize at some point.
    function draw_continous_crate_view(color_scale){
        var scale = d3.scale.linear().domain(linspace(0,255,color_scale.length)).range(color_scale);
        var coloringFunc = function(data) {
            return function(k, i) {
                var v = data[k];
                if (v === null || typeof v === 'undefined') {
                    return 'background-color:#e0e0e0';
                }
                else {
                    return 'background-color:' + scale(v);
        }};}
        hover_text_func = function(data) {
        return function(d,i) {
            v = data[d];
            if(v == null){
                return "Unknown/Crate Off";
            }
            return v;
        }};
        return display_crate_view(key,crates_data,sizeinfo,node,
                {'attrib':'style','func':coloringFunc},hover_text_func);
    }
    crate_node = draw_continous_crate_view(color_scale);
    function redraw(color_scale){
        node.select("#crate").remove()
        draw_continous_crate_view(color_scale)
    }
    return redraw
}
function display_crate_view(key,crates_data,sizeinfo,node,styling,hover_text)
{
    var d = crates_data.map(function(crate,i) {
    if(crate) {
            MBs =  crate.fecs.map(function(mb,i) {
                if(typeof(key) == 'function') {
                        return key(mb);
                }
                else if (typeof(mb[key]) != 'undefined'){
                    return mb[key];
                }
                else {
                   return Array.apply(null,Array(32)).map(function(x,i){return null;})
                }
            });
            return  flattenArray(MBs)
        }
        else {
            return Array.apply(null,Array(512)).map(function(x,i){return null;})
        }
    });
    d = flattenArray(d)
    var crate = crate_view()
        .caption(true)
        .height(sizeinfo.height)
        .width(sizeinfo.width);
    if(hover_text){
    crate.hover_text(hover_text);
    }
    if(styling){
        stylingFunc = crate.stylingFunction();
        if(styling.func){
            stylingFunc = stylingFunc.coloringFunction(styling.func);
        }
        if(styling.attrib){
            stylingFunc = stylingFunc.attribute(styling.attrib);
        }
        crate = crate.stylingFunction(stylingFunc);
    }

    var g = node.append('div')
            .attr('id','crate')
            .attr('width',sizeinfo.width)
            .attr('height',sizeinfo.height)
            .attr('class',"col-md-10 col-md-offset-1");
    g.datum(d).call(crate);
}
function num_crates_in_rack(irack) {
    if(irack>11 || irack <=0) {
        return 0;
    }
    if([3,7,10].indexOf(irack) != -1)
    {
        return 1;
    }
    return 2;
}
function get_crates_in_rack(irack) {
    if (irack>11 || irack<= 0)
    {return -1;}
    if(typeof(irack) != 'number'){
        irack = parseInt(irack);
    }
    crates_below = 0;
    for(var i=1; i<irack;i++){
        crates_below += num_crates_in_rack(i);
    }
    if(num_crates_in_rack(irack) == 1)
    {
        return [crates_below];
    }
    return  [crates_below,crates_below+1];
}

function num_crates_on(det_cont_info) {
    var count = 0;
    if(det_cont_info['iboot'] == 0)
    {
        return 0;
    }
    for (var key in det_cont_info)
    {
        if(det_cont_info.hasOwnProperty(key)) {
            if(key.indexOf('rack') != -1 && key.indexOf("timing") == -1) {
                if(det_cont_info[key]) {
                    count += num_crates_in_rack(parseInt(key.split('rack')[1]));
                }
            }
        }
    }
    return count;
}

function display_detector_control(detector_control_info) {
    var det_cont = d3.select("#detector_control");
    var bounds = det_cont.node().parentElement.parentElement.clientWidth
    var height = 100;
    var width = bounds;
    var step_size = width/15;
    radius = step_size/4.0;
    var xpos_func = function(d,i) { return step_size+i*step_size; }
    var ypos_func = function(d,i) { return height/2.0; }

    var svg = det_cont.append("svg")
        .attr("width",width)
        .attr("height",height)
        .attr("viewBox","0 0 "+width.toString()+" "+height.toString())
        .attr("class","rack_mask");

    var arr = [];
    arr.push(["T",detector_control_info["timing_rack"]]);
    for(var i=1;i<12;i++) {
        arr.push([i.toString(),detector_control_info["rack"+i.toString()]]);
    }
    nodes = svg.append('g').selectAll('circle')
        .data(arr)
        .enter()
        .append('g')
        .attr("transform",function(d,i){
            d.x = xpos_func(d,i);
            d.y = ypos_func(d,i);
            return "translate(" + d.x+","+d.y+")";
        });

    nodes.append("title").text(function(d,i){
        str = ""
        if(d[0] == "T"){ str = "Timing Rack: ";}
        else {
            crates = get_crates_in_rack(d[0])
            crate_str = "";
            if(crates.length == 1){
                crate_str = "crate "+crates[0];
            }
            else{
                crate_str = "crates "+crates[0]+" and "+crates[1];
            }
            str = "Rack "+d[0]+" ("+crate_str+"): ";
        }
        str = str + (d[1]==1 ? 'on' : 'off');
        return str;
    });
    nodes.append('circle')
        .attr("r",radius)
        .attr("class",function(d) { return d[1]==1 ? 'on' : 'off'; });
    nodes.append('text')
        .text(function(d){return d[0];})
        .attr("text-anchor","middle")
        .attr("font-size","16px")
        .attr("fill","white")
        .attr("y",function(d,i) { return 5;});
}

function display_triggers(node,wordlist) {
    display_array_as_list(node,wordlist,'Enabled Triggers');
};

function display_ped_delay(node,delay) {
    node.append("h3").text("Pedestal Delay = "+ delay.toString() +"ns");
};

function display_pulser_rate(node,pulser_rate) {
    node.append("h3").text("Pulser Rate = "+ pulser_rate.toString() + "Hz");
};

function display_lockout_width(node,lockout) {
    node.append("h3").text("Lockout Width = "+ lockout.toString()+"ns");
};

function display_control_reg(node,wordlist) {
    display_array_as_list(node,wordlist,'Control Register Values');
};

function display_crates(title,crates) {
    var mtc = d3.select('#mtc');
    mtc.append('h3').text(title);
    var crate_list = mtc.append('ul');
    crate_list.selectAll('li')
        .data(crates)
        .enter()
        .append('li')
        .text(function(d) { return d;});
};

function display_prescale(node,prescale) {
    mtc.append('h3').text('Prescale = '+prescale.toString());
};

function display_caen(node,caen_info) {
    var size_info = {};
    size_info['width'] = node.node().parentElement.parentElement.parentElement.clientWidth;
    size_info['height'] = 25;
    channel_text = function(d,i){
        str = "Channel "+i+": ";
        return str +(d ? "enabled" : "disabled");
    }
    display_bit_mask(caen_info.enabled_channels,node,"Enabled Channels" ,size_info,channel_text);
    node.append('h4').text("Acquisition Mode = "+caen_info.acquisition_mode);
    node.append('h4').text("Trigger Logic Levels = "+caen_info.trigger_voltage_level);
    node.append('h4').text("Number of Post Trigger Samples = "+ caen_info.post_trigger);
    node.append('h4').text("LVDS Mode = "+ caen_info.lvds_mode);
    if (caen_info.channel_offsets){
        var offset_list = node.append('h4').text("Channel Offsets")
        node.append('ul')
            .selectAll('li')
            .data(caen_info.channel_offsets)
            .enter()
            .append('li')
            .text(function(d,i) {
                return "Channel " + i + " = " + d.toFixed(2) + "V";}); //what is d(-1V)? what is i (channel)?
    }
};

function display_tubii(tubii_info) {
    var tubii = d3.select("#tubii");

    // Trigger, speaker & counter masks
    display_tubii_mask(tubii,"Sync Trigger Mask","trigger_mask",0);
    display_tubii_mask(tubii,"Async Trigger Mask","async_trigger_mask",0);
    display_tubii_mask(tubii,"Speaker Mask","speaker_mask",1);
    display_tubii_mask(tubii,"Counter Mask","counter_mask",1);

    var cmode;
    if(tubii_data["counter_mode"]==1) cmode="Rate";
    else cmode="Totaliser";
    tubii.append('h5').text("Counter mode: " + cmode);

    // Trigger settings
    tubii.append('h4').text("Trigger Settings")
    //tubii.append('h5').text("Burst Trigger Settings: Not implemented yet");
    tubii.append('h5').text("Combo Trigger Settings: " + tubii_data["combo_mask"] + "/" + tubii_data["combo_enable_mask"]);
    tubii.append('h5').text("Prescale Trigger Settings: x" + tubii_data["prescale_value"] + " on channel " + tubii_data["prescale_channel"]);
    tubii.append('h5').text("TUBii PGT Rate: " + tubii_data["pgt_rate"] + " Hz");

    tubii.append('h4').text("TUBii Settings")
    var csource, losource, cbackup, ecal;
    if(tubii_data["clock_source"]==1) csource="TUBii";
    else csource="TUB";
    tubii.append('h5').text("Clock Source: " + csource);
    if(tubii_data["clock_status"]==1) cbackup="BAD";
    else cbackup="GOOD";
    tubii.append('h5').text("Clock Status: " + cbackup);
    if(tubii_data["lo_source"]==1) losource="TUBii";
    else losource="TUB";
    tubii.append('h5').text("Lockout Source: " + losource);
    if(tubii_data["ecal"]==1) ecal="ON";
    else ecal="OFF";
    tubii.append('h5').text("ECAL Mode: " + ecal);
    tubii.append('h5').text("CAEN Gain Path: " + tubii_data["caen_gain_path"]); // 1-8, high is attenuating
    tubii.append('h5').text("CAEN Channel Selected: " + tubii_data["caen_channel_select"]);
    // 1 means A9 goes to Scope/Caen Ch 1 instead of A1
    // 2 means A10 goes to Scope/Caen Ch2 instead of A2
    // 4 means A11 goes to Scope/Caen Ch3 instead of A3
    // 8 means A8 to Scope/Caen Ch 0 instead of A0
    tubii.append('h5').text("DGT: " + tubii_data["dgt_reg"] + " ns");
    tubii.append('h5').text("LO: " + tubii_data["lockout_reg"] + " ns");
    tubii.append('h5').text("DAC Thresh: " + tubii_data["dac_reg"] + " V");

    tubii.append('h4').text("Pulsers & Delays")
    tubii.append('h5').text("SMELLIE Pulser: " + tubii_data["smellie_pulse_rate"] + " Hz, width " + tubii_data["smellie_pulse_width"] + " ns");
    tubii.append('h5').text("SMELLIE Delay: " + tubii_data["smellie_delay_length"] + " ns");
    tubii.append('h5').text("TELLIE Pulser: " +tubii_data["tellie_pulse_rate"] + " Hz, width " + tubii_data["tellie_pulse_width"] + " ns");
    tubii.append('h5').text("TELLIE Delay: " + tubii_data["tellie_delay_length"] + " ns");
    tubii.append('h5').text("TUBii Pulser: " +tubii_data["pulse_rate"] + " Hz, width " + tubii_data["pulse_width"] + " ns");
    tubii.append('h5').text("TUBii Delay: " + tubii_data["delay_length"] + " ns");

};
function display_tubii_mask(tubii,title,mask,gt){
    var bounds = tubii.node().parentElement.parentElement.clientWidth;
    var height = 50;
    var width = bounds;
    var step_size = width/30;
    radius = step_size;
    var xpos_func = function(d,i) { return step_size+i*step_size; }
    var ypos_func = function(d,i) { return height/4.0; }

    tubii.append('h4').text(title);
    var svg = tubii.append("svg")
    .attr("width",width)
    .attr("height",height)
    .attr("viewBox","0 0 "+width.toString()+" "+height.toString())
    .attr("class","rack_mask");
    var arr = [];
    for(var i=0;i<16;i++) {
	arr.push([i.toString(),(tubii_data[mask]&(1<<i))/(1<<i),"External Trigger " + i.toString()]);
    }
    arr.push(["M1",(tubii_data[mask]&(1<<16))/(1<<16),"MTCA Mimic 1"]);
    arr.push(["M2",(tubii_data[mask]&(1<<17))/(1<<17),"MTCA Mimic 2"]);
    arr.push(["B",(tubii_data[mask]&(1<<18))/(1<<18),"Burst Trigger"]);
    arr.push(["C",(tubii_data[mask]&(1<<19))/(1<<19),"Combo Trigger"]);
    arr.push(["P",(tubii_data[mask]&(1<<20))/(1<<20),"Prescale Trigger"]);
    arr.push(["PGT",(tubii_data[mask]&(1<<21))/(1<<21),"TUBii PGT"]);
    arr.push(["T",(tubii_data[mask]&(1<<22))/(1<<22),"TELLIE"]);
    arr.push(["S",(tubii_data[mask]&(1<<23))/(1<<23),"SMELLIE"]);
    if(gt==1) arr.push(["GT",(tubii_data[mask]&(1<<24))/(1<<24),"Global Trigger"]);
    svg.selectAll('rect')
        .data(arr)
        .enter()
        .append('rect')
        .attr("x",xpos_func)
        .attr("y",ypos_func)
        .attr("width",radius)
        .attr("height",radius)
        .attr("fill",function(d) { return d[1]==1 ? 'green' : 'red'; })
        .attr("class",function(d) { return d[1]==1 ? 'on' : 'off'; })
        .append("svg:title")
        .text(function(d){return d[2];});
    svg.selectAll('text')
        .data(arr)
        .enter()
        .append('text')
        .text(function(d){return d[0];})
        .attr("text-anchor","middle")
        .attr("font-size","16px")
        .attr("fill","white")
        .attr("x",function(d,i) { return xpos_func(d,i)+0.5*radius;})
        .attr("y",function(d,i) { return ypos_func(d,i)+0.5*radius+5;});
}

function display_array_as_list(node,arr,title) {
    node.append('h3').text(title);
    var display_node = node.append('ul');
    display_node.selectAll('li')
        .data(arr)
        .enter()
        .append('li')
        .text(function(d) { return d.toString();});

}
function display_dictionary_as_list(node,dict,title) {
    keys =Object.keys(dict)
    node.append('h3').text(title);
    var display_node = node.append('ul');
    display_node.selectAll('li')
        .data(keys)
        .enter()
        .append('li')
        .text(function(d) { return d+' = '+dict[d].toString();});

}

function get_enabled_dacs(dacs,gt_mask)
{
    keys = Object.keys(dacs)
    new_dict = {};
    for(var i=0;i<keys.length;i++)
    {
        if(gt_mask.indexOf(
                keys[i].replace(' ','')
                .replace('N100','NHIT100')
                .replace('N20',"NHIT20")) != -1)
        {
            new_dict[keys[i]] = dacs[keys[i]];
        }
    }
    return new_dict;
}

function display_mtc(node,mtc_data){

    display_triggers(node,mtc_data.gt_words);

    enabled_dacs = get_enabled_dacs(mtc_data.MTCA_DACs,mtc_data.gt_words);
    display_mtca_thresholds(node,mtc_data.MTCA_DACs,trigger_scan,enabled_dacs, true);

    display_lockout_width(node,mtc_data.lockout_width);
    display_control_reg(node,mtc_data.control_reg);
    if(mtc_data.control_reg.filter(function(x) { x.indexOf("PED") > -1;}))
    {display_ped_delay(node,mtc_data.ped_delay);}
    display_pulser_rate(node,mtc_data.pulser_rate);
    display_prescale(node,mtc_data.prescale);
    var size_info ={};
    size_info['width']= node.node().parentElement.parentElement.clientWidth
    size_info['height']= 25;

    text_factory =function(verb,direction){
        return function(name){
            return function(d,i) {
                return verb+" "+name+" signal "+direction+" crate "+i+": "+(d ? "enabled" : "disabled");
            }
        }
    }
    mtcd_mask_text_factory = text_factory("Sending","to");

    display_bit_mask(mtc_data.gt_crates,node,"GT",size_info,mtcd_mask_text_factory("GT"));
    display_bit_mask(mtc_data.ped_crates,node,"PED",size_info,mtcd_mask_text_factory("PED"));

    node.append('h3')
        .text("MTCA Relays")
        .append('div')
        .attr('class',"col-xs-12")
        .append('hr');

    mtca_relay_text_factory = text_factory("Summing","from");
    display_bit_mask(mtc_data.N100_crates,node,"N100",size_info,mtca_relay_text_factory("N100"));
    display_bit_mask(mtc_data.N20_crates,node,"N20",size_info,mtca_relay_text_factory("N20"));
    display_bit_mask(mtc_data.ESUMHI_crates,node,"ESUM HI",size_info,mtca_relay_text_factory("ESUM HI"));
    display_bit_mask(mtc_data.ESUMLO_crates,node,"ESUM LO",size_info,mtca_relay_text_factory("ESUM LO"));
    display_bit_mask(mtc_data.OWLELO_crates,node,"OWLE LO",size_info,mtca_relay_text_factory("OWLE LO"));
    display_bit_mask(mtc_data.OWLEHI_crates,node,"OWLE HI",size_info,mtca_relay_text_factory("OWLE HI"));
    display_bit_mask(mtc_data.OWLN_crates,node,"OWLN",size_info,mtca_relay_text_factory("OWLN"));
}

function display_mtca_thresholds(node, dacs, trigger_scan, enabled_dacs, add_colors){
    function dac_to_volts(value) { return (10.0/4096)*value - 5.0; }
    volt_dict = {}

    node.append("h3").text("Thresholds");
    table = node.append('table').attr('class','table')
    head = table.append('thead').append('tr')
    head.append('th').text('Name')
    head.append('th').text('Volts')
    head.append('th').text('NHits')

    keys = Object.keys(dacs)
    table.append('tbody')
        .selectAll('tr')
        .data(keys)
        .enter()
        .append('tr')
        .attr('class',function(key) {
            if(enabled_dacs && enabled_dacs[key] && add_colors)
            { return 'success'; }
            return '';
        })
        .attr('title',function(key){
            if(enabled_dacs && enabled_dacs[key])
            { return key+' is masked in'; }
            return key+' is NOT masked in';
        })
        .selectAll('td')
        .data( function(key,i) {
            dac_count = dacs[key];
            volts = dac_to_volts(dac_count).toFixed(2);
            nHit = '-';
            if(trigger_scan[key])
            {
                baseline = trigger_scan[key][0];
                adc_per_nhit = trigger_scan[key][1];
                nHit = (dac_count - baseline)/adc_per_nhit;
                nHit = nHit.toFixed(2)
            }
            return [key,volts,nHit];
        })
        .enter()
        .append('td')
        .text( function(row,i) {
            return row;
        });
}
function display_bit_mask(mask,dom_node,title,size_info,title_text) {
    var width = size_info.width;
    var height =size_info.height;
    dv = dom_node.append("div");
    dv.append("h4").text(title).attr("float","left");
    var svg = dv.append("svg")
        .attr("width",width)
        .attr("height",height)
        .attr("viewBox","0 0 "+width.toString()+" "+height.toString())
        .attr("class","crate_mask");
    var title_percent = 0.10;
    var title_width = title_percent*width;
    width=(1- title_percent)*width;
    var step_size = width/(mask.length+1);
    var xpos_func = function(d,i) { return title_width+i*step_size; }
    var ypos_func = function(d,i) { return height/2.0; }

    nodes = svg.append('g').selectAll("circle")
        .data(mask)
        .enter()
        .append('g')
        .attr('transform',function(d,i){
            return "translate("+xpos_func(d,i)+", "+ypos_func(d,i)+")";});

    if(title_text)
    {
        nodes.append("title").text(title_text);
    }

    nodes.append("circle")
        .attr("r",height/2.0)
        .attr("class",function(d) { return d ? 'on' : 'off'; })

    nodes.append('text')
        .text(function(d,i){return i.toString();})
        .attr("text-anchor","middle")
        .attr("font-size","10px")
        .attr("fill","white")
        .attr("y",function(d,i) { return 3;});
};
function display_run_type(run_type,time_stamp) {
    var run_type_translation = {
    0:"Maintenance",
    1:"Transition",
    2:"Physics",
    3:"Deployed Source",
    4:"External Source",
    5:"ECA",
    6:"Diagnostic",
    7:"Experimental",
    8:"Supernova"
    };
    var calib_translation = {
    11:"TELLIE",
    12:"SMELLIE",
    13:"AMELLIE",
    14:"PCA",
    15:"ECA Pedestal",
    16:"ECA Time Slope"
    };
    var detector_state_translation = {
    21:"DCR Activity",
    22:"Compensation Coils Off",
    23:"PMTS Off",
    24:"Bubblers On",
    25:"Cavity Recirculation ON",
    26:"SL Assay",
    27:"Unusual Activity",
    28:"AV Recirculation ON"
    };
    var flag = false;
    var translator = function(low_bit,high_bit,trans_map){
        ret = []
        for(i=low_bit;i<=high_bit;i++)
        {
            if(run_type & (1<<i)) {
                if(i-low_bit >= Object.keys(trans_map).length) {
                   ret.push(" SPARE (???)");
                }
                else {
                    ret.push(" "+trans_map[i]);
                }
            }
        }
        return ret;
    };
    var run_desc = translator(0,10,run_type_translation);
    var calib_desc = translator(11,20,calib_translation);
    var det_state_desc = translator(21,31,detector_state_translation);
    if(run_desc.length == 0) {
        run_desc.push("None");
    }
    var title = document.getElementById("run_title");
    var appendToTitle = function(type,desc){
        var thisSubTitle = document.createElement('h2');
        thisSubTitle.appendChild(document.createTextNode(desc.toString()));
        title.appendChild(thisSubTitle);
    }
    appendToTitle('h2',run_desc);
    if(calib_desc.length > 0){
        appendToTitle('h3',calib_desc);
    }
    if(det_state_desc.length > 0){
        appendToTitle('h3',det_state_desc);
    }

    // Passed time stamp is assumed to be in Eastern time.
    // The DB should always be in Sudbury so this is safe
    date = moment.tz(time_stamp, "America/Toronto");
    str = date.format("ddd, MMM Do YYYY - HH:mm:ss z");
    appendToTitle('p',str);
};
function display_hv_status(hv_node, hv_data) {
        var width = hv_node.node().parentElement.parentElement.clientWidth;
        var height = 75;
        var step_size = width/(1+hv_data.length);
        radius = step_size/3;
        var svg = hv_node.append("svg")
            .attr("width",width)
            .attr("height",height)
            .attr("viewBox","0 0 "+width.toString()+" "+height.toString());
            nodes = hv_node.append('g').selectAll('circle')
            .data(hv_data)
            .enter();
        nodes = svg.append('g').selectAll('circle')
            .data(hv_data)
            .enter()
            .append('g')
            .attr("transform",function(d,i){
                x = step_size*(i+1);
                y = height/2;
                return "translate(" + x+","+y+")";
            });

    nodes.append('text')
        .text(function(d, i){ return d.title; })
        .attr("text-anchor","middle")
        .attr("font-size","16px")
        .attr("fill","black")
        .attr("y",function(d,i) { return radius*2;});

        nodes.append("g")
            .append('circle')
            .attr("r",radius)
            .attr("class",function(d) { return d.on ? 'on' : 'off'; });
        g = nodes.append("g");
        g.append('clipPath')
            .attr("id",function(d,i) {return "g-clip"+i.toString();})
            .append('rect')
            .attr("id","g-clip-rect")
            .attr("y",-radius*2)
            .attr('height', function(d,i) {
                if(d.on) { return radius*3 - (d.hv/d.nominal)*radius*2; }
                return radius*3;
            })
            .attr("x",-radius*2)
            .attr('width', radius*4);

        g.append("circle")
            .attr("clip-path",function(d,i) { return "url(#g-clip"+i.toString()+")";})
            .attr('r',radius*0.90)
            .attr("fill","#fff");


}
function crate() {
    var width = 780;
    var height = 80;

    function my(){

    }
    my.width = function(value) {
        if(!arguments.length) {
            return width;
        }
        width = value;
        return my;
    }
    my.height = function(value) {
        if(!arguments.length) {
            return height;
        }
        height = value;
        return my;
    }
    return my;
}
function change_colors(class_name,color) {
    var cols = document.getElementsByClassName(class_name);
    for(i=0;i<cols.length;i++) {
        cols[i].style.fill = color;
        cols[i].style['background-color'] = color;
    }
}
