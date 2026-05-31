import type { Request } from "express";

type LogLevel = "info" | "warn" | "error";

interface SessionLoggerOpts {
  level?: LogLevel;
  env?: Record<string, string | undefined>;
}

export function sessionLogger(
  req: Pick<Request, "method" | "path">,
  msg: string,
  opts?: SessionLoggerOpts,
): void {
  const env = opts?.env ?? process.env;
  const level: LogLevel = opts?.level ?? "info";
  const nodeEnv = env.NODE_ENV;
  const verbose = env.LOG_VERBOSE === "true";

  const prefix = `[Session] ${req.method} ${req.path}`;

  if (verbose) {
    dispatch(level, prefix, msg);
    return;
  }

  if (nodeEnv === "test") {
    return;
  }

  if (nodeEnv === "production") {
    if (level === "warn" || level === "error") {
      dispatch(level, prefix, msg);
    }
    return;
  }

  // development or anything else
  dispatch(level, prefix, msg);
}

function dispatch(level: LogLevel, prefix: string, msg: string): void {
  if (level === "info") {
    console.log(prefix, msg);
  } else if (level === "warn") {
    console.warn(prefix, msg);
  } else {
    console.error(prefix, msg);
  }
}
