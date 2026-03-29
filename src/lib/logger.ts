/**
 * Simple Logger for Gelani Healthcare Assistant
 * Used by OpenTelemetry instrumentation
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [Gelani]`;
  return `${prefix} ${message}`;
}

export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', message), ...args);
    }
  },

  info: (message: string, ...args: unknown[]): void => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.info) {
      console.log(formatMessage('info', message), ...args);
    }
  },

  warn: (message: string, ...args: unknown[]): void => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message), ...args);
    }
  },

  error: (message: string, ...args: unknown[]): void => {
    if (LOG_LEVELS[currentLevel] <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message), ...args);
    }
  },
};

export default logger;
