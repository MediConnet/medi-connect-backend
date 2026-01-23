export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

export class Logger {
  private context: Record<string, any>;

  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, error?: Error, extra?: Record<string, any>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(Object.keys(this.context).length > 0 && { context: this.context }),
      ...(extra && { ...extra }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    const logString = JSON.stringify(entry);
    console.log(logString);
  }

  debug(message: string, extra?: Record<string, any>): void {
    if (process.env.STAGE === 'dev') {
      this.log(LogLevel.DEBUG, message, undefined, extra);
    }
  }

  info(message: string, extra?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, undefined, extra);
  }

  warn(message: string, extra?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, undefined, extra);
  }

  error(message: string, error?: Error, extra?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, error, extra);
  }

  withContext(context: Record<string, any>): Logger {
    return new Logger({ ...this.context, ...context });
  }
}

// Singleton logger instance
export const logger = new Logger();
