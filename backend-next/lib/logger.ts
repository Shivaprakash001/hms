import pino from "pino";

const level = process.env.LOG_LEVEL || "info";
const isProduction = process.env.NODE_ENV === "production";

// `pino-pretty` transport is helpful locally but can break in serverless runtimes.
// Keep production logger transport-free for maximum compatibility.
const logger = isProduction
  ? pino({ level })
  : pino({
      level,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    });

export function getLogger(name: string) {
  return logger.child({ component: name });
}
