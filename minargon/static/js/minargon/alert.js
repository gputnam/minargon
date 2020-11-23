export function throw_alert(text, divID) {
  $(".alert-holder").append(
    `<div class="alert alert-primary alert-dismissible fade show" id="` + divID + `">` +
     `<div class="inline">` + text + `</div>` +
    `<div class="hollowLoader inline"><div class="largeBox"></div><div class="smallBox"></div></div>` +
    `<button type="button" class="close" data-dismiss="alert" aria-label="Close">
        <span aria=hidden="true">&times;</span>
    </button>
  </div>`
  );
}

export function remove_alert(divID) {
   $(".alert-holder").find("#"+divID).remove();
}
