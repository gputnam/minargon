function createPage(runNumber, plotDivName){
    var histFileName = $SCRIPT_ROOT + "/static/nlrat/r" + runNumber.toString() + "_nl_th1f.root";
    var ntupFileName = $SCRIPT_ROOT + "/static/nlrat/r" + runNumber.toString() + "_nl_ntups.zip";
    document.getElementById("histbut").onclick = function(){window.open(histFileName);};
    document.getElementById("ntupbut").onclick = function(){window.open(ntupFileName);};

    displaySummary(histFileName, document.getElementById(plotDivName));
}

function createPlotDivs(names, parentDiv){
    var fragment = document.createDocumentFragment();
    names.forEach(function(name){
            if (!document.getElementById(name)){
                var row = document.createElement("div");
                row.className = "row plot";

                var col = document.createElement("div");
                col.className = "col-md-12 plot";

                var div = document.createElement("div");
                div.id = name;
                div.className = "plot";

                col.appendChild(div);
                row.appendChild(col);
                fragment.appendChild(row);
            }
        });
    parentDiv.appendChild(fragment);
}

function createPlotGrid(names, parentDiv){
    var ncols = 3;
    var nrows = Math.ceil(names.length/ncols);
    var divs = [];

    var fragment = document.createDocumentFragment();
    var iName = 0;
    for(var iRow = 0; iRow < nrows; iRow++){
        var row = document.createElement("div");
        row.className = "row plot";

          for(var iCol = 0; iCol < ncols; iCol++){
            var col = document.createElement("div");
            col.className = "col-md-4 plot";

            var div = document.createElement("div");
            div.className = "plot";
            div.id = names[iName++];

            col.appendChild(div);
            row.appendChild(col);
            divs.push(div);
        }
        fragment.appendChild(row);
    }
    parentDiv.appendChild(fragment);
    return divs;
}

function readBranch(keyName){
    var name = keyName.substring(0, keyName.lastIndexOf("_"));
    var num  = keyName.substring(keyName.lastIndexOf("_") + 1, keyName.length);
    return {"name" : name, "num" : parseInt(num)};
}

function compareKeys(a, b){
    var parsedA = readBranch(a);
    var parsedB = readBranch(b);
    if (parsedA.name === parsedB.name){
        return parsedA.num - parsedB.num;
    }
    return a.localeCompare(b);
}

function readBranches(histNames){
    var branchNames = new Set();
    histNames.forEach(function(key){branchNames.add(readBranch(key).name)});
    return Array.from(branchNames);
}

function addSidebarEntry(branchName, fragment){
    var entry = document.createElement("li");
    var link  = document.createElement("a");
    link.href = "javascript:void(0)";

    link.innerHTML = branchName;
    link.className = "branchLink";

    entry.appendChild(link);
    fragment.appendChild(entry);
}

function fillSidebar(keyNames){
    if(typeof(arguments.callee.done) == "undefined"){
        var fragment = document.createDocumentFragment();
        var branchNames = readBranches(keyNames);
        branchNames.sort();
        branchNames.forEach(function(branch){
                addSidebarEntry(branch, fragment);
            });

        document.getElementById("sidebarlist").appendChild(fragment);
        arguments.callee.done = 1;
    }
}

function linkSidebar(histFileName, plotDiv){
    if(typeof(arguments.callee.done) == "undefined"){
        var links = document.getElementsByClassName("branchLink");
        var linkArray  = [].slice.call(links, 0);
        linkArray.forEach(
                          function(link){
                              link.addEventListener("click",
                                                    function(){
                                                        displayBranch(histFileName, plotDiv, link.innerHTML);
                                                        $(".active").removeClass("active");
                                                        link.className = "active";
                                                    });

                          });

        document.getElementById("summary-button").addEventListener("click",
                                                                   function(evt){
                                                                       displaySummary(histFileName, plotDiv);
                                                                       $(".active").removeClass("active");
                                                                       evt.target.className = "active";
                                                                   });
        arguments.callee.done = 1;
    }

}

function displaySummary(histFileName, plotDiv){
    window.onresize = function(){displaySummary(histFileName, plotDiv);};
    // open file
    new JSROOT.TFile(histFileName, function(file){
            // read the keys inside
            var plotNames = [];
            var keyNames = [];
            file.fKeys.forEach(function(key){
                    var keyName = key.fName;
                    if(keyName === "StreamerInfo")
                        return;

                    if(typeof(branchName) != 'undefined' && readBranch(keyName).name != branchName){
                        return;
                    }

                    plotNames.push(keyName);
                });
            plotNames.sort(compareKeys);

            $(".plot").remove();
            createPlotGrid(plotNames, plotDiv);
            plotNames.forEach(function(plotName){
                    file.ReadObject(plotName, function(obj) {
                            JSROOT.draw(plotName, obj, "E");
                            JSROOT.draw(plotName, obj, "HISTF");
                        });
                });

            fillSidebar(plotNames);
            linkSidebar(histFileName, plotDiv);
    });
}


function displayBranch(histFileName, plotDiv, branchName){
    window.onresize = function(){displayBranch(histFileName, plotDiv, branchName);};
    // open file
    new JSROOT.TFile(histFileName, function(file){
            // read the keys inside
            var plotNames = [];
            var keyNames = [];
            file.fKeys.forEach(function(key){
                    var keyName = key.fName;
                    if(keyName === "StreamerInfo")
                        return;

                    if(typeof(branchName) != "undefined" && readBranch(keyName).name != branchName){
                        return;
                    }

                    plotNames.push(keyName);
                });
            plotNames.sort(compareKeys);

            $(".plot").remove();
            createPlotDivs(plotNames, plotDiv);
            plotNames.forEach(function(plotName){
                    file.ReadObject(plotName, function(obj) {
                            JSROOT.draw(plotName, obj, "E");
                            JSROOT.draw(plotName, obj, "HISTF");
                        });
                });
    });
}
