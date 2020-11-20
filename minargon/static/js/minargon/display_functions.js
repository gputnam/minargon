function display_invert(dat) {
  return [dat[0], 1. / dat[1]];
}

function display_noop(dat) {
  return dat;
}


export function get_display_function(string) {
  if (string == "invert") {
    return display_invert;
  }
  return display_noop;
}

