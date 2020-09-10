import {throw_database_error} from "./error.js";

export class Poll {
  constructor(link) {
    this.link = link;    
    this.callbacks = [];
    this.timeout = 5000;
  }

  add_callback(f) {
    this.callbacks.push(f.bind(this));
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
     setTimeout(self.run.bind(self), self.timeout);
    });
  }

}
