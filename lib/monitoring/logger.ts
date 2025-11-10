import { LogEntry } from './types'
import { log as logToMonitoring } from './core'

// Log levels with numeric priorities
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
} as const

// Structured logger class
export class Logger {
  private component: string
  private context: Record<string, any>
  private minLevel: number

  constructor(component: string, context: Record<string, any> = {}, minLevel: LogEntry['level'] = 'info') {
    this.component = component
    this.context = context
    this.minLevel = LOG_LEVELS[minLevel]
  }

  // Create a child logger with additional context
  child(childContext: Record<string, any>): Logger {
    return new Logger(
      this.component,
      { ...this.context, ...childContext },
      Object.keys(LOG_LEVELS).find(level => LOG_LEVELS[level as keyof typeof LOG_LEVELS] === this.minLevel) as LogEntry['level']
    )
  }

  // Change minimum log level
  level(level: LogEntry['level']): Logger {
    return new Logger(this.component, this.context, level)
  }

  // Debug level logging
  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context)
  }

  // Info level logging
  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context)
  }

  // Warning level logging
  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context)
  }

  // Error level logging
  error(message: string, context?: Record<string, any>, error?: Error) {
    this.log('error', message, context, error)
  }

  // Fatal level logging
  fatal(message: string, context?: Record<string, any>, error?: Error) {
    this.log('fatal', message, context, error)
  }

  // Generic log method
  log(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, any>,
    error?: Error
  ) {
    // Check if this level should be logged
    if (LOG_LEVELS[level] < this.minLevel) {
      return
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        ...this.context,
        ...context
      },
      component: this.component,
      error
    }

    // Add to monitoring system
    logToMonitoring(level, message, {
      ...logEntry.context,
      component: this.component,
      error: error?.message,
      stack: error?.stack
    })

    // Console output with structured format
    this.outputToConsole(logEntry)
  }

  // Output to console with structured formatting
  private outputToConsole(logEntry: LogEntry) {
    const timestamp = new Date().toLocaleTimeString()
    const level = logEntry.level.toUpperCase().padEnd(5)
    const component = this.component.padEnd(15)

    const logObject = {
      timestamp,
      level,
      component,
      message: logEntry.message,
      context: logEntry.context
    }

    switch (logEntry.level) {
      case 'debug':
        console.debug(logObject)
        break
      case 'info':
        console.info(logObject)
        break
      case 'warn':
        console.warn(logObject)
        break
      case 'error':
        console.error(logObject, logEntry.error || '')
        break
      case 'fatal':
        console.error(logObject, logEntry.error || '')
        break
    }
  }
}

// Global logger instance
export const globalLogger = new Logger('global')

// Convenience functions for the global logger
export const debug = (message: string, context?: Record<string, any>) => 
  globalLogger.debug(message, context)

export const info = (message: string, context?: Record<string, any>) => 
  globalLogger.info(message, context)

export const warn = (message: string, context?: Record<string, any>) => 
  globalLogger.warn(message, context)

export const error = (message: string, context?: Record<string, any>, err?: Error) => 
  globalLogger.error(message, context, err)

export const fatal = (message: string, context?: Record<string, any>, err?: Error) => 
  globalLogger.fatal(message, context, err)

// Create a component-specific logger
export function createLogger(component: string, context?: Record<string, any>) {
  return new Logger(component, context)
}

// Request context for tracking requests across the system
export class RequestContext {
  private static contexts = new Map<string, any>()

  static set(requestId: string, context: Record<string, any>) {
    this.contexts.set(requestId, context)
  }

  static get(requestId: string) {
    return this.contexts.get(requestId)
  }

  static remove(requestId: string) {
    this.contexts.delete(requestId)
  }

  static getOrCreate(requestId: string, defaultContext: Record<string, any> = {}) {
    let context = this.get(requestId)
    if (!context) {
      context = defaultContext
      this.set(requestId, context)
    }
    return context
  }
}

// Middleware for request logging
export function createRequestLogger(component: string) {
  return (requestId: string) => {
    const context = RequestContext.getOrCreate(requestId, {
      requestId,
      component
    })
    return new Logger(component, context)
  }
}

// Performance logging
export class PerformanceLogger {
  private static operations = new Map<string, number>()

  static start(operation: string) {
    this.operations.set(operation, performance.now())
  }

  static end(operation: string, logger: Logger) {
    const startTime = this.operations.get(operation)
    if (startTime) {
      const duration = performance.now() - startTime
      this.operations.delete(operation)
      
      logger.info(`Operation completed`, {
        operation,
        duration: `${duration.toFixed(2)}ms`,
        durationMs: duration
      })
      
      return duration
    }
  }

  static async measure<T>(operation: string, fn: () => Promise<T>, logger: Logger): Promise<T> {
    this.start(operation)
    try {
      const result = await fn()
      this.end(operation, logger)
      return result
    } catch (error) {
      this.end(operation, logger)
      logger.error(`Operation failed`, { operation, error: error instanceof Error ? error.message : error })
      throw error
    }
  }
}

// Database query logging
export class DatabaseLogger {
  static logQuery(query: string, duration: number, logger: Logger, context?: Record<string, any>) {
    const isSlow = duration > 1000 // 1 second threshold
    
    logger.info(`Database query executed`, {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration: `${duration.toFixed(2)}ms`,
      durationMs: duration,
      isSlow,
      ...context
    })

    if (isSlow) {
      logger.warn(`Slow database query detected`, {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        duration: `${duration.toFixed(2)}ms`,
        threshold: '1000ms'
      })
    }
  }
}

// API call logging
export class ApiLogger {
  static logCall(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    logger: Logger,
    context?: Record<string, any>
  ) {
    const isError = statusCode >= 400
    const level = isError ? 'error' : 'info'
    
    logger.log(level, `API call ${isError ? 'failed' : 'completed'}`, {
      method,
      url,
      statusCode,
      duration: `${duration.toFixed(2)}ms`,
      durationMs: duration,
      ...context
    })

    if (isError) {
      logger.error(`API call failed`, {
        method,
        url,
        statusCode,
        error: `HTTP ${statusCode}`,
        duration: `${duration.toFixed(2)}ms`
      })
    }
  }
}

// User action logging
export class UserActionLogger {
  static logAction(userId: string | null, action: string, context: Record<string, any> = {}, logger: Logger) {
    logger.info(`User action`, {
      userId: userId || 'anonymous',
      action,
      ...context
    })
  }
}

// Error logging with context
export class ErrorLogger {
  static logError(
    error: Error,
    context: Record<string, any> = {},
    logger?: Logger
  ): LogEntry {
    const logContext = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...context
    }

    if (logger) {
      logger.error(`Error occurred`, logContext, error)
    } else {
      globalLogger.error(`Error occurred`, logContext, error)
    }

    return {
      level: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
      context: logContext,
      error
    }
  }
}

// Environment-specific logging configuration
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'

// Configure default log levels based on environment
export const getDefaultLogLevel = (): LogEntry['level'] => {
  if (isDevelopment) return 'debug'
  if (isProduction) return 'info'
  return 'info'
}

// Create environment-specific logger
export const createEnvironmentLogger = (component: string, context?: Record<string, any>) => {
  return new Logger(component, context, getDefaultLogLevel())
}