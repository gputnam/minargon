// Make a string into a title by capitalizing things
export function titleize(str) {
    return str.replace(/_/g, ' ')
              .replace(/\w\S*/g, function(txt){
                 // don't mess with the capitalization of alpha-numeric things
                 if (/\d/g.test(txt)) {
                   return txt;
                 }
                 return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
               })
              .replace(/\w\S*/g, function(txt){
                   return txt.replace(/^Tpc$/g, "TPC")
                   .replace(/^Ww$/g, "WW")
                   .replace(/^Ee$/g, "EE")
                   .replace(/^Ew$/g, "EW")
                   .replace(/^We$/g, "WE")
                   .replace(/^Id$/g, "ID")
                   .replace(/^Crt$/g, "CRT")
                   .replace(/^Pmt$/g, "PMT")
                   .replace(/^Chan$/g, "CHAN")
                   .replace(/^Asic$/g, "ASIC")
                   .replace(/^Femb$/g, "FEMB")
                   .replace(/^Rms$/g, "RMS")
                   .replace(/^Dnoise$/g, "DNoise");
 
               });
}
