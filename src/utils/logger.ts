/**
 * Logger utility - Simplified logging system for Cloudflare Workers
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Record<string, any>;

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = 'info';
  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...context,
    };
    return JSON.stringify(logData);
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatLog('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  error(message: string, error: Error | any, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        ...(error instanceof Error ? {
          error: error.message,
          stack: error.stack,
        } : typeof error === 'object' ? error : { error }),
      };
      console.error(this.formatLog('error', message, errorContext));
    }
  }

  // Static convenience methods
  static debug(message: string, context?: LogContext): void {
    Logger.getInstance().debug(message, context);
  }

  static info(message: string, context?: LogContext): void {
    Logger.getInstance().info(message, context);
  }

  static warn(message: string, context?: LogContext): void {
    Logger.getInstance().warn(message, context);
  }

  static error(message: string, error?: Error | LogContext, context?: LogContext): void {
    const instance = Logger.getInstance();
    if (error instanceof Error) {
      instance.error(message, error, context);
    } else if (error && !context) {
      // Legacy usage where error is actually context
      instance.error(message, undefined, error as LogContext);
    } else {
      instance.error(message, undefined, context);
    }
  }

  static logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    error?: Error
  ): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${method} ${path} ${statusCode} ${duration}ms`;
    const context: LogContext = {
      method,
      path,
      statusCode,
      duration,
      type: 'api_request',
    };
    
    if (error) {
      Logger.error(message, error, context);
    } else if (level === 'error') {
      Logger.error(message, undefined, context);
    } else if (level === 'warn') {
      Logger.warn(message, context);
    } else {
      Logger.info(message, context);
    }
  }

  static logScheduledTask(
    taskName: string,
    status: 'started' | 'completed' | 'failed',
    context?: LogContext
  ): void {
    const message = `Scheduled task ${taskName} ${status}`;
    const taskContext = { ...context, taskName, taskStatus: status, type: 'scheduled_task' };
    
    switch (status) {
      case 'started':
        Logger.info(message, taskContext);
        break;
      case 'completed':
        Logger.info(message, taskContext);
        break;
      case 'failed':
        Logger.error(message, undefined, taskContext);
        break;
    }
  }
}

// Export the logger instance for backward compatibility
export const logger = Logger.getInstance();