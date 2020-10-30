var prior_warnings = [];

export function throw_database_error(d3_error, reporter) {
  if (d3_error.response) {
      try {
        var response_info = JSON.parse(d3_error.response);
      }
      catch (err) {
        prior_warnings.push(d3_error.response);
        throw_error_internal(d3_error.response);
        return;
      }
  }
  else {
    var response_info = "";
  }
  var warning_text = "";
  if (response_info.database_name !== undefined && response_info.description !== undefined) {
    warning_text = "Database connection error " + String(d3_error.status) + " (" + response_info.database_name + "): " + response_info.description;
  }
  else {
    warning_text = "Unknown error";
    console.log(d3_error);
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

