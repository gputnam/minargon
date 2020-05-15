import {throw_database_error} from "./error.js";

export class Poll {
  constructor(link) {
    this.link = link;    
    this.callbacks = [];
  }

  add_callback(f) {
    this.callbacks.push(f);
  }

  run() {
   var self = this;
   d3.json(this.link, function(err, data) {
     if (!data) {
       throw_database_error(err, "Poll.run");
     }
     for (var i = 0; i < self.callbacks.length; i++) {
       self.callbacks[i](data);
     }
     setTimeout(self.run.bind(self), 5000);
    });
  }

}
