import { getDatabase } from './database';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  id?: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: Date;
  source?: string;
}

class Logger {
  private async persistLog(entry: LogEntry): Promise<void> {
    try {
      const db = await getDatabase();
      await db.execute(`
        INSERT INTO system_logs (level, message, context, source, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [
        entry.level,
        entry.message,
        JSON.stringify(entry.context || {}),
        entry.source || 'system',
        entry.timestamp
      ]);
    } catch (error) {
      // Fallback to console if database logging fails
      console.error('Failed to persist log to database:', error);
      console.log('Original log entry:', entry);
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(8);
    const context = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
    return `[${timestamp}] ${level} ${entry.message}${context}`;
  }

  private async log(level: LogLevel, message: string, context?: LogContext, source?: string): Promise<void> {
    const entry: LogEntry = {
      level,
      message,
      context,
      source,
      timestamp: new Date()
    };

    // Always log to console for immediate visibility
    const consoleMessage = this.formatConsoleMessage(entry);
    
    switch (level) {
      case 'debug':
        console.debug(consoleMessage);
        break;
      case 'info':
        console.info(consoleMessage);
        break;
      case 'warn':
        console.warn(consoleMessage);
        break;
      case 'error':
      case 'critical':
        console.error(consoleMessage);
        break;
    }

    // Persist to database for monitoring dashboard
    if (level !== 'debug') {
      await this.persistLog(entry);
    }
  }

  async debug(message: string, context?: LogContext, source?: string): Promise<void> {
    await this.log('debug', message, context, source);
  }

  async info(message: string, context?: LogContext, source?: string): Promise<void> {
    await this.log('info', message, context, source);
  }

  async warn(message: string, context?: LogContext, source?: string): Promise<void> {
    await this.log('warn', message, context, source);
  }

  async error(message: string, context?: LogContext, source?: string): Promise<void> {
    await this.log('error', message, context, source);
  }

  async critical(message: string, context?: LogContext, source?: string): Promise<void> {
    await this.log('critical', message, context, source);
  }

  // Convenience method for logging errors with stack traces
  async logError(error: Error, message?: string, context?: LogContext, source?: string): Promise<void> {
    const errorContext = {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };

    await this.error(message || error.message, errorContext, source);
  }

  // Method for performance monitoring
  async logPerformance(operation: string, duration: number, context?: LogContext, source?: string): Promise<void> {
    await this.info(`Performance: ${operation} completed in ${duration}ms`, {
      ...context,
      operation,
      duration,
      type: 'performance'
    }, source);

    // Also persist to performance metrics table
    try {
      const db = await getDatabase();
      await db.execute(`
        INSERT INTO performance_metrics (operation, duration_ms, context, created_at)
        VALUES (?, ?, ?, ?)
      `, [
        operation,
        duration,
        JSON.stringify(context || {}),
        new Date()
      ]);
    } catch (error) {
      console.error('Failed to persist performance metric:', error);
    }
  }

  // Method for queue operations
  async logQueueOperation(operation: string, queueName: string, itemId?: string, context?: LogContext): Promise<void> {
    await this.info(`Queue operation: ${operation}`, {
      ...context,
      operation,
      queueName,
      itemId,
      type: 'queue'
    }, 'queue-system');
  }

  // Method for API operations
  async logApiOperation(method: string, endpoint: string, statusCode: number, duration?: number, context?: LogContext): Promise<void> {
    const level = statusCode >= 400 ? 'error' : 'info';
    await this.log(level, `API ${method} ${endpoint} - ${statusCode}`, {
      ...context,
      method,
      endpoint,
      statusCode,
      duration,
      type: 'api'
    }, 'api');
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
export const logCritical = logger.critical.bind(logger);