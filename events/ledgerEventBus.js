const EventEmitter = require("events");
const prisma = require("../config/prisma");
const { isValidEvent } = require("./eventTypes");

class LedgerEventBus extends EventEmitter {
  async emitEvent(eventName, payload = {}) {
    if (!isValidEvent(eventName)) {
      console.warn(`[LedgerEventBus] Ignored unknown event: ${eventName}`);
      return;
    }

    try {
      const structuredEvent = {
        event: eventName,
        timestamp: new Date().toISOString(),
        userId: payload.userId != null ? String(payload.userId) : "SYSTEM",
        severity: payload.severity || "INFO",
        message: payload.message || eventName,
        meta: payload.meta || {},
      };

      this.emit(eventName, structuredEvent);

      if (process.env.NODE_ENV !== "test") {
        prisma.eventLog
          .create({
            data: {
              eventName: structuredEvent.event,
              userId: payload.userId != null ? Number(payload.userId) : null,
              severity: structuredEvent.severity,
              message: structuredEvent.message,
              meta: structuredEvent.meta,
            },
          })
          .catch((err) => {
            console.error("[LedgerEventBus] EventLog persist failed:", err.message);
          });
      }
    } catch (err) {
      console.error("[LedgerEventBus] emit failed:", err.message);
    }
  }
}

module.exports = new LedgerEventBus();
