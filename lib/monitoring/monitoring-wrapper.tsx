'use client'

import { useEffect, ReactNode } from 'react'
import { initMonitoring } from '@/lib/monitoring/core'
import { WebVitalsTracker, UserInteractionTracker } from '@/lib/monitoring/web-vitals'
import { createEnvironmentLogger } from '@/lib/monitoring/logger'

const logger = createEnvironmentLogger('app/layout')

interface MonitoringWrapperProps {
  children: ReactNode
}

export function MonitoringWrapper({ children }: MonitoringWrapperProps) {
  useEffect(() => {
    try {
      // Initialize monitoring system
      initMonitoring({
        enableSentry: process.env.NODE_ENV === 'production',
        enableWebVitals: true,
        enableCustomMetrics: true,
        enableUserInteractionTracking: true,
        sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // Sample 10% in production
        flushInterval: 10000, // 10 seconds
        maxQueueSize: 1000,
        alertThresholds: [
          {
            metric: 'response_time',
            condition: 'greater_than',
            value: 3000,
            duration: 30,
            severity: 'high',
            enabled: true
          },
          {
            metric: 'error_rate',
            condition: 'greater_than',
            value: 5,
            duration: 60,
            severity: 'critical',
            enabled: true
          },
          {
            metric: 'web_vital_lcp',
            condition: 'greater_than',
            value: 4000,
            duration: 60,
            severity: 'medium',
            enabled: true
          },
          {
            metric: 'web_vital_cls',
            condition: 'greater_than',
            value: 0.25,
            duration: 60,
            severity: 'medium',
            enabled: true
          },
          {
            metric: 'web_vital_fid',
            condition: 'greater_than',
            value: 300,
            duration: 60,
            severity: 'medium',
            enabled: true
          },
          {
            metric: 'memory_usage',
            condition: 'greater_than',
            value: 85,
            duration: 120,
            severity: 'medium',
            enabled: true
          }
        ]
      })

      logger.info('Monitoring system initialized', {
        environment: process.env.NODE_ENV,
        hasSentry: Boolean(process.env.SENTRY_DSN),
        version: process.env.npm_package_version
      })

    } catch (error) {
      console.error('Failed to initialize monitoring system:', error)
      logger.error('Monitoring initialization failed', { 
        error: error instanceof Error ? error.message : error 
      })
    }
  }, [])

  return (
    <>
      <WebVitalsTracker />
      <UserInteractionTracker />
      {children}
    </>
  )
}

// Error recovery strategies
export class ErrorRecovery {
  private static retryAttempts = new Map<string, number>()
  private static maxRetries = 3

  static async withRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    options: {
      maxRetries?: number
      backoffMs?: number
      onRetry?: (attempt: number, error: Error) => void
      onFinalError?: (error: Error) => void
    } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries || this.maxRetries
    const backoffMs = options.backoffMs || 1000
    const attempts = this.retryAttempts.get(operation) || 0

    try {
      const result = await fn()
      // Reset retry count on success
      this.retryAttempts.delete(operation)
      return result
    } catch (error) {
      const currentAttempts = attempts + 1
      
      if (currentAttempts < maxRetries) {
        this.retryAttempts.set(operation, currentAttempts)
        
        logger.warn(`Operation failed, retrying (${currentAttempts}/${maxRetries})`, {
          operation,
          attempt: currentAttempts,
          maxRetries,
          error: error instanceof Error ? error.message : error
        })

        // Call retry callback
        if (options.onRetry) {
          options.onRetry(currentAttempts, error as Error)
        }

        // Exponential backoff
        const delay = backoffMs * Math.pow(2, currentAttempts - 1)
        await new Promise(resolve => setTimeout(resolve, delay))

        // Retry the operation
        return this.withRetry(operation, fn, options)
      } else {
        // Max retries reached
        this.retryAttempts.delete(operation)
        
        logger.error(`Operation failed after ${maxRetries} attempts`, {
          operation,
          maxRetries,
          error: error instanceof Error ? error.message : error,
          finalError: true
        })

        // Call final error callback
        if (options.onFinalError) {
          options.onFinalError(error as Error)
        }

        throw error
      }
    }
  }

  // Circuit breaker pattern
  static createCircuitBreaker<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: {
      failureThreshold?: number
      resetTimeoutMs?: number
      onStateChange?: (state: 'closed' | 'open' | 'half-open') => void
    } = {}
  ) {
    const failureThreshold = options.failureThreshold || 5
    const resetTimeoutMs = options.resetTimeoutMs || 60000
    let failures = 0
    let lastFailureTime: number | null = null
    let state: 'closed' | 'open' | 'half-open' = 'closed'

    const setState = (newState: 'closed' | 'open' | 'half-open') => {
      state = newState
      if (options.onStateChange) {
        options.onStateChange(newState)
      }
      logger.info('Circuit breaker state changed', { state, failures, operation: fn.name })
    }

    return async (...args: T): Promise<R> => {
      const now = Date.now()

      // Check if circuit should transition from open to half-open
      if (state === 'open' && lastFailureTime && now - lastFailureTime > resetTimeoutMs) {
        setState('half-open')
      }

      // If circuit is open, fail fast
      if (state === 'open') {
        throw new Error(`Circuit breaker is open for operation: ${fn.name}`)
      }

      try {
        const result = await fn(...args)
        
        // Success - close circuit and reset failure count
        if (state === 'half-open') {
          setState('closed')
        }
        failures = 0
        
        return result
      } catch (error) {
        failures++
        lastFailureTime = now

        // If failure threshold reached, open circuit
        if (failures >= failureThreshold) {
          setState('open')
        }

        throw error
      }
    }
  }

  // Graceful degradation
  static async withFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    try {
      return await primaryFn()
    } catch (error) {
      logger.warn(`Primary operation failed, using fallback`, {
        operation,
        error: error instanceof Error ? error.message : error
      })

      try {
        return await fallbackFn()
      } catch (fallbackError) {
        logger.error(`Both primary and fallback operations failed`, {
          operation,
          primaryError: error instanceof Error ? error.message : error,
          fallbackError: fallbackError instanceof Error ? fallbackError.message : fallbackError
        })
        throw error // Re-throw original error
      }
    }
  }

  // Timeout wrapper
  static withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    operation: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout: ${operation} exceeded ${timeoutMs}ms`))
        }, timeoutMs)
      })
    ])
  }

  // Bulkhead isolation
  static createBulkhead<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    maxConcurrent: number = 10
  ) {
    let activeCount = 0

    return async (...args: T): Promise<R> => {
      if (activeCount >= maxConcurrent) {
        throw new Error(`Bulkhead full: ${activeCount}/${maxConcurrent} concurrent operations`)
      }
      
      activeCount++
      try {
        return await fn(...args)
      } finally {
        activeCount--
      }
    }
  }
}

// Sentry configuration and integration
export function configureSentry() {
  if (typeof window === 'undefined') return

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) {
    console.warn('Sentry DSN not configured')
    return
  }

  // Note: This would require @sentry/nextjs package
  // For now, we'll set up the basic configuration structure
  logger.info('Sentry configuration loaded', {
    dsn: dsn.substring(0, 10) + '...',
    environment: process.env.NODE_ENV
  })

  // TODO: Initialize Sentry with proper configuration
  // Sentry.init({
  //   dsn,
  //   environment: process.env.NODE_ENV,
  //   tracesSampleRate: 0.1,
  //   beforeSend(event) {
  //     // Filter out noisy errors or handle sensitive data
  //     return event
  //   }
  // })
}