import "server-only";

type LogContext = Record<string, unknown>;

function log(level: "info" | "warn" | "error", event: string, context: LogContext) {
  const payload = {
    event,
    ...context,
  };

  if (level === "error") {
    console.error("[scopeshield]", payload);
    return;
  }

  if (level === "warn") {
    console.warn("[scopeshield]", payload);
    return;
  }

  console.log("[scopeshield]", payload);
}

export function logInfo(event: string, context: LogContext = {}) {
  log("info", event, context);
}

export function logWarn(event: string, context: LogContext = {}) {
  log("warn", event, context);
}

export function logError(event: string, context: LogContext = {}) {
  log("error", event, context);
}
