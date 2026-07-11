const ledgerEventBus = require("../events/ledgerEventBus");
const { EVENTS } = require("../events/eventTypes");

/** Emit a validated real-time event. */
function emit(eventName, payload = {}) {
  ledgerEventBus.emitEvent(eventName, payload);
}

module.exports = { emit, EVENTS };
