var prior_warnings = [];

export function throw_database_error(d3_error, reporter) {
  var warning_text = "";
  if (d3_error.status == 404) {
    warning_text = "Database connection error 404: Attempting to connect to unknown database";
  }
  else if (d3_error.status == 503) {
    var response_info = JSON.parse(d3_error.response);
    warning_text = "Database connection error 502 (" + response_info.database_name + "): " + response_info.description;
  }
  else {
    warning_text = "Unknown error";
  }
  warning_text = warning_text + " (" + reporter + ")";
  // avoid duplicate warnings
  for (var i = 0; i <prior_warnings.length; i++) {
    if (prior_warnings[i] == warning_text) {
      return;
    }
  }
  prior_warnings.push(warning_text);
  throw_error_internal(warning_text);
}

export function throw_custom_error(warning_text) {
  throw_error_internal(warning_text);
}

function throw_error_internal(warning_text) {
  $(".alert-holder").append(
    `<div class="alert alert-warning alert-dismissible fade show">` +
     warning_text + 
    `<button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria=hidden="true">&times;</span>
    </button>
  </div>`
  );
}

