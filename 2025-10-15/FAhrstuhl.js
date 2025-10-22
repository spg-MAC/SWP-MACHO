// Simple elevator (lift) simulation
// Models: floors, internal panel requests, external calls (floor + direction), doors, movement
// Behaviors implemented per user's specification:
// - A lift moves between numbered floors
// - A lift has a panel of buttons passengers can press (internal requests)
// - People can call the lift from other floors (call = floor + direction)
// - A lift has doors which may be open or closed
// - A lift fulfills a request when it moves to the requested floor and opens the doors
// - A lift fulfills a call when it moves to the correct floor, is about to go in the called direction, and opens the doors
// - A lift can only move between floors if the doors are closed

class Elevator {
  constructor({minFloor = 1, maxFloor = 10, name = 'Elevator', travelTimeMs = 400, doorOperateMs = 700, doorDwellMs = 0} = {}) {
    this.name = name;
    this.minFloor = minFloor;
    this.maxFloor = maxFloor;
    this.currentFloor = minFloor;
    this.direction = 'idle'; // 'up' | 'down' | 'idle'
    this.doorsOpen = false;

    // Internal panel requests: set of floors
    this.requests = new Set();

    // Calls: Map<floor, Set<direction>> where direction is 'up' or 'down'
    this.calls = new Map();

    // Timing and run control
    this.travelTimeMs = travelTimeMs;
    // doorOperateMs: time to open OR close the doors (ms)
    // doorDwellMs: time doors remain fully open before starting to close (ms)
    this.doorOperateMs = doorOperateMs;
    this.doorDwellMs = doorDwellMs;
    this._running = false;
  }

  // Helper to validate floor
  _validFloor(floor) {
    return Number.isInteger(floor) && floor >= this.minFloor && floor <= this.maxFloor;
  }

  // Passenger inside presses a floor button
  pressFloor(floor) {
    if (!this._validFloor(floor)) {
      console.warn(`${this.name}: invalid floor request ${floor}`);
      return;
    }
    this.requests.add(floor);
    console.log(`${this.name}: internal request for floor ${floor}`);
  }

  // External call from floor with desired direction
  callFrom(floor, direction) {
    direction = direction === 'up' ? 'up' : 'down';
    if (!this._validFloor(floor)) {
      console.warn(`${this.name}: invalid call from floor ${floor}`);
      return;
    }
    if (floor === this.maxFloor && direction === 'up') {
      console.warn(`${this.name}: can't call up from top floor ${floor}`);
      return;
    }
    if (floor === this.minFloor && direction === 'down') {
      console.warn(`${this.name}: can't call down from bottom floor ${floor}`);
      return;
    }
    if (!this.calls.has(floor)) this.calls.set(floor, new Set());
    this.calls.get(floor).add(direction);
    console.log(`${this.name}: external call at floor ${floor} wanting ${direction}`);
  }

  // Open doors (fulfills any internal requests for this floor and matching calls)
  async openDoors(reason = '') {
    if (this.doorsOpen) return;
    console.log(`${this.name}: opening doors at floor ${this.currentFloor}${reason ? ' (' + reason + ')' : ''}`);

    // simulate opening animation/time
    await this._sleep(this.doorOperateMs);
    this.doorsOpen = true;

    // Fulfill internal request for this floor
    if (this.requests.has(this.currentFloor)) {
      this.requests.delete(this.currentFloor);
      console.log(`${this.name}: fulfilled internal request for floor ${this.currentFloor}`);
    }

    // Fulfill calls only if they match the direction we are about to take
    const callsHere = this.calls.get(this.currentFloor);
    if (callsHere && callsHere.size > 0) {
      // If direction is idle, treat opening as fulfilling all calls (people will then board and press inside buttons)
      if (this.direction === 'idle') {
        for (const d of callsHere) {
          console.log(`${this.name}: fulfilled external call at ${this.currentFloor} for ${d} (idle -> opening)`);
        }
        this.calls.delete(this.currentFloor);
      } else {
        // Only fulfill calls that match the current direction
        if (callsHere.has(this.direction)) {
          console.log(`${this.name}: fulfilled external call at ${this.currentFloor} for ${this.direction}`);
          callsHere.delete(this.direction);
        }
        if (callsHere.size === 0) this.calls.delete(this.currentFloor);
      }
    }

    // time doors remain fully open (dwell)
    if (this.doorDwellMs > 0) await this._sleep(this.doorDwellMs);
    await this.closeDoors();
  }

  async closeDoors() {
    if (!this.doorsOpen) return;
    console.log(`${this.name}: closing doors at floor ${this.currentFloor}`);
    // simulate closing animation/time
    await this._sleep(this.doorOperateMs);
    this.doorsOpen = false;
  }

  // Decide the next direction given current targets
  _decideDirection() {
    if (this.requests.size === 0 && this.calls.size === 0) return 'idle';

    // Build list of all target floors we care about
    const targets = new Set(this.requests);
    for (const [floorStr] of this.calls) targets.add(Number(floorStr));

    // Convert to array and find nearest above/below
    const targetsArr = Array.from(targets).map(Number);
    const above = targetsArr.filter(f => f > this.currentFloor);
    const below = targetsArr.filter(f => f < this.currentFloor);

    if (this.direction === 'up') {
      if (above.length > 0) return 'up';
      if (below.length > 0) return 'down';
      return 'idle';
    }
    if (this.direction === 'down') {
      if (below.length > 0) return 'down';
      if (above.length > 0) return 'up';
      return 'idle';
    }

    // if idle, choose the nearest target (tie -> up)
    if (above.length === 0 && below.length === 0) return 'idle';
    if (above.length === 0) return 'down';
    if (below.length === 0) return 'up';
    const nearestAbove = Math.min(...above) - this.currentFloor;
    const nearestBelow = this.currentFloor - Math.max(...below);
    return nearestAbove <= nearestBelow ? 'up' : 'down';
  }

  // Move one floor in the current direction (doors must be closed)
  async _moveOneFloor() {
    if (this.doorsOpen) {
      console.warn(`${this.name}: cannot move while doors open`);
      return;
    }
    if (this.direction === 'idle') return;
    const targetFloor = this.direction === 'up' ? this.currentFloor + 1 : this.currentFloor - 1;
    if (!this._validFloor(targetFloor)) {
      // hit a boundary -> become idle
      console.log(`${this.name}: reached boundary at ${this.currentFloor}`);
      this.direction = 'idle';
      return;
    }
    console.log(`${this.name}: moving ${this.direction} from ${this.currentFloor} to ${targetFloor}`);
    await this._sleep(this.travelTimeMs);
    this.currentFloor = targetFloor;

    // When we arrive, we only open doors if either there's an internal request for this floor
    // OR there's an external call for this floor that matches the direction we're about to go (per spec)
    const shouldOpenForRequest = this.requests.has(this.currentFloor);
    const callsHere = this.calls.get(this.currentFloor);
    const shouldOpenForCall = callsHere && callsHere.has(this.direction);

    if (shouldOpenForRequest || shouldOpenForCall) {
      await this.openDoors('arrived to serve request/call');
    } else {
      // Otherwise, continue moving (unless no more targets in this direction)
      console.log(`${this.name}: passing floor ${this.currentFloor}`);
    }
  }

  // Background loop that keeps elevator running
  async start() {
    if (this._running) return;
    this._running = true;
    console.log(`${this.name}: starting main loop (floors ${this.minFloor}-${this.maxFloor})`);

    while (this._running) {
      // decide direction
      this.direction = this._decideDirection();

      if (this.direction === 'idle') {
        // If there are no targets, wait for a short time and check again
        await this._sleep(250);
        continue;
      }

      // ensure doors are closed before moving
      if (this.doorsOpen) {
        await this.closeDoors();
      }

      await this._moveOneFloor();
    }
  }

  stop() {
    this._running = false;
    console.log(`${this.name}: stopping main loop`);
  }

  // small utility
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// --- Demo / Example run ---
if (require.main === module) {
  const lift = new Elevator({minFloor: 1, maxFloor: 7, name: 'FAhrstuhl', travelTimeMs: 3000, doorOperateMs: 1000, doorDwellMs: 0});

  // Start the elevator loop
  lift.start();

  // Simulate some external calls and internal presses
  setTimeout(() => lift.callFrom(3, 'up'), 200);
  setTimeout(() => lift.callFrom(6, 'down'), 400);
  setTimeout(() => lift.pressFloor(5), 1200); // passenger inside presses 5
  setTimeout(() => lift.callFrom(2, 'up'), 1600);
  setTimeout(() => lift.pressFloor(1), 2200);

  // Stop after some time
  setTimeout(() => {
    lift.stop();
    console.log('Demo complete');
  }, 8000);
}

module.exports = { Elevator };
