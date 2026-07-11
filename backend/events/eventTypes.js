/**
 * All real-time events — single source of truth.
 * Business code must only emit events listed here.
 */
const EVENTS = Object.freeze({
  TRANSACTION_CREATED: "TRANSACTION_CREATED",
  AUDIT_COMPLETE: "AUDIT_COMPLETE",
  VERIFICATION_STARTED: "VERIFICATION_STARTED",
  VERIFICATION_OK: "VERIFICATION_OK",
  TAMPER_DETECTED: "TAMPER_DETECTED",
  INCIDENT_CREATED: "INCIDENT_CREATED",
  INCIDENT_UPDATED: "INCIDENT_UPDATED",
  LEDGER_LOCKED: "LEDGER_LOCKED",
  LEDGER_UNLOCKED: "LEDGER_UNLOCKED",
  REPAIR_STARTED: "REPAIR_STARTED",
  REPAIR_COMPLETED: "REPAIR_COMPLETED",
});

const EVENT_LIST = Object.freeze(Object.values(EVENTS));

function isValidEvent(name) {
  return EVENT_LIST.includes(name);
}

module.exports = { EVENTS, EVENT_LIST, isValidEvent };
