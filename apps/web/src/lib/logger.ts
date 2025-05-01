import winston from "winston";

export const logger = winston.createLogger({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Add timestamp
    winston.format.errors({ stack: true }), // Log stack traces for errors
    winston.format.json(), // Log in JSON format
  ),
  defaultMeta: { service: "user-service" }, // Optional: metadata added to all logs
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Add colors
        winston.format.simple(), // Simple format: level: message
      ),
      level: "debug", // Log everything to console in dev
    }),
  );
}
