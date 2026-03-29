/**
 * Logger Module for Gelani Healthcare Assistant
 * ==============================================
 *
 * Provides structured logging with support for:
 * - Log levels (debug, info, warn, error)
 * - JSON formatted output in production
 * - Pretty output in development
 * - OpenTelemetry integration ready
 *
 * HIPAA Compliance: Never log PHI in plain text
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug');
const serviceName = process.env.OTEL_SERVICE_NAME || 'gelani-nextjs';

class Logger {
  private level: number;

  constructor() {
    this.level = LOG_LEVELS[currentLevel] ?? LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.level;
  }

  private formatEntry(level: LogLevel, message: string, ...args: unknown[]): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: serviceName,
    };

    // Add additional context from args
    if (args.length > 0) {
      args.forEach((arg, index) => {
        if (arg instanceof Error) {
          entry[`error${index}`] = {
            name: arg.name,
            message: arg.message,
            stack: arg.stack,
          };
        } else if (typeof arg === 'object' && arg !== null) {
          Object.assign(entry, arg);
        } else {
          entry[`arg${index}`] = arg;
        }
      });
    }

    if (isProduction) {
      return JSON.stringify(entry);
    }

    // Pretty print for development
    const colors = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';
    const levelStr = `[${level.toUpperCase().padEnd(5)}]`;

    return `${colors[level]}${levelStr}${reset} ${entry.timestamp} - ${message}${args.length > 0 ? ' ' + JSON.stringify(args) : ''}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatEntry('debug', message, ...args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatEntry('info', message, ...args));
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatEntry('warn', message, ...args));
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatEntry('error', message, ...args));
    }
  }

  // For structured logging with context
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(level)) {
      const formatted = this.formatEntry(level, message, context);
      switch (level) {
        case 'debug':
          console.debug(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
          console.error(formatted);
          break;
      }
    }
  }

  // Create child logger with persistent context
  child(defaultContext: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private context: Record<string, unknown>
  ) {}

  debug(message: string, ...args: unknown[]): void {
    this.parent.debug(message, this.context, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.parent.info(message, this.context, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.parent.warn(message, this.context, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.parent.error(message, this.context, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing
export { Logger };

// Export types
export type { LogLevel, LogEntry };
