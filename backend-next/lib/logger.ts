/**
 * Structured Logging Utility
 * Ensures consistent log format across all services
 */

type LogFunction = (message: string, meta?: any) => void;
type Logger = {
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  metrics: LogFunction;
};

function write(level: "INFO" | "WARN" | "ERROR" | "METRIC", service: string, event: string, meta?: any) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service,
    event,
    message: event,
    ...(meta || {}),
  };

  const line = JSON.stringify(payload);
  if (level === "WARN") return console.warn(line);
  if (level === "ERROR") return console.error(line);
  return console.info(line);
}

function createLogger(service: string): Logger {
  return {
    info: (message: string, meta?: any) => {
      write("INFO", service, message, meta);
    },

    warn: (message: string, meta?: any) => {
      write("WARN", service, message, meta);
    },

    error: (message: string, meta?: any) => {
      write("ERROR", service, message, meta);
    },

    metrics: (message: string, meta?: any) => {
      write("METRIC", service, message, meta);
    },
  };
}

export function getLogger(service: string): Logger {
  return createLogger(service);
}

// Default logger instance
export const logger = createLogger("app");
