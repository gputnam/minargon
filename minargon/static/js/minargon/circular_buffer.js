// Has no external dependencies

// Defines a CircularBuffer class to be used to store time-series data
export class CircularBuffer{

  // capacity: the number of data points to go into the circular buffer
  constructor(capacity) {
    this.buffer = new Array(capacity);
    this.capacity = capacity;
    this.first = 0;
    this.size = 0;
  }

  // get the first element in the circular buffer -- fails if size == 0
  get_first() {
    return this.get(0);
  }

  // get the last element in the circular buffer -- fails if size == 0
  get_last() {
    return this.get((this.first + this.size - 1) % this.capacity);
  }

  // push a new value to the end of the circular buffer
  push(value) {
    // wraparound
    if (this.size == this.capacity) {
      this.buffer[this.first] = value;
      this.first = (this.first + 1) % this.capacity;
    }
    // fill-up 
    else {
      this.buffer[(this.first+this.size) % this.capacity] = value;
      this.size ++;
    }
  } 

  // get a list of elements from the circular buffer
  // The elements returned will be in the range [start, end).
  // Both numbers should be smaller than the size of the buffer.
  // If end is omitted, then this function will return a single object 
  // at the location "start"
  get(start, end) {
    if (this.size == 0 && start == 0 && (end == undefined || end == 0)) return [];
    if (start > this.size) throw new RangeError("Index past end of buffer: " + start);
    if (end==undefined) return this.buffer[(this.first + start) % this.capacity];

    if (end > this.size) throw new RangeError("Index past end of buffer: " + end);
    
    // fix range of start 
    if (this.first + start > this.capacity) {
       start -= this.capacity;
       end -= this.capacity;
    }

    if (this.first + end < this.capacity)
        return this.buffer.slice(this.first+start, this.first+end+1);
    else 
        return this.buffer.slice(this.first+start, this.capacity)
            .concat(this.buffer.slice(0, this.first + end + 1 - this.capacity));
  }

  // reset the data in the circular buffer
  reset() {
    this.first = 0;
    this.size = 0;
  }

}
