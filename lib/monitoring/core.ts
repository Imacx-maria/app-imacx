import { Metric, PerformanceMetric, ErrorEvent, LogEntry, SystemHealth, MonitoringConfig, Alert, AlertThreshold } from './types'

// Global monitoring state
let isInitialized = false
let metricsBuffer: Metric[] = []
let errorsBuffer: ErrorEvent[] = []
let logsBuffer: LogEntry[] = []
let performanceBuffer: PerformanceMetric[] = []
let alerts: Alert[] = []
let health: SystemHealth | null = null
let config: MonitoringConfig | null = null

// Default configuration
const DEFAULT_CONFIG: MonitoringConfig = {
  enableSentry: process.env.NODE_ENV === 'production',
  enableWebVitals: true,
  enableCustomMetrics: true,
  enableUserInteractionTracking: true,
  sampleRate: 1.0,
  flushInterval: 5000, // 5 seconds
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
      metric: 'lcp',
      condition: 'greater_than',
      value: 4000,
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
}

// Initialize monitoring system
export function initMonitoring(overrideConfig?: Partial<MonitoringConfig>) {
  if (isInitialized) return
  
  config = { ...DEFAULT_CONFIG, ...overrideConfig }
  isInitialized = true
  
  // Start periodic flushing
  setInterval(() => {
    flushBuffers()
  }, config.flushInterval)
  
  // Monitor system health
  startHealthCheck()
  
  console.log('📊 Monitoring system initialized', config)
}

// Record a metric
export function recordMetric(name: string, value: number, type: Metric['type'] = 'counter', tags?: Record<string, string | number>) {
  if (!isInitialized) return
  
  const metric: Metric = {
    name,
    value,
    type,
    tags,
    timestamp: new Date().toISOString()
  }
  
  metricsBuffer.push(metric)
  
  // Check alerts
  checkAlertThresholds(metric)
  
  if (metricsBuffer.length >= (config?.maxQueueSize || 1000)) {
    flushBuffers()
  }
}

// Record performance metric
export function recordPerformanceMetric(metric: Omit<PerformanceMetric, 'timestamp'>) {
  if (!isInitialized || !config?.enableWebVitals) return
  
  const performanceMetric: PerformanceMetric = {
    ...metric,
    timestamp: new Date().toISOString()
  }
  
  performanceBuffer.push(performanceMetric)
  
  if (performanceBuffer.length >= (config?.maxQueueSize || 1000)) {
    flushBuffers()
  }
}

// Record error
export function recordError(error: Error, context?: Record<string, any>) {
  if (!isInitialized) return
  
  const errorEvent: ErrorEvent = {
    id: generateId(),
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    severity: 'error',
    context,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined
  }
  
  errorsBuffer.push(errorEvent)
  recordMetric('error_count', 1, 'counter', { 
    error_type: error.constructor.name,
    context: context?.component || 'unknown'
  })
  
  if (errorsBuffer.length >= (config?.maxQueueSize || 1000)) {
    flushBuffers()
  }
}

// Log entry
export function log(level: LogEntry['level'], message: string, context?: Record<string, any>) {
  if (!isInitialized) return
  
  const logEntry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context
  }
  
  logsBuffer.push(logEntry)
  
  if (logsBuffer.length >= (config?.maxQueueSize || 1000)) {
    flushBuffers()
  }
}

// Flush all buffers
async function flushBuffers() {
  if (metricsBuffer.length === 0 && errorsBuffer.length === 0 && 
      logsBuffer.length === 0 && performanceBuffer.length === 0) {
    return
  }
  
  try {
    const payload = {
      metrics: [...metricsBuffer],
      errors: [...errorsBuffer],
      logs: [...logsBuffer],
      performance: [...performanceBuffer],
      timestamp: new Date().toISOString()
    }
    
    // Send to monitoring API
    const response = await fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (response.ok) {
      // Clear buffers on success
      metricsBuffer = []
      errorsBuffer = []
      logsBuffer = []
      performanceBuffer = []
    }
  } catch (error) {
    console.warn('Failed to flush monitoring data:', error)
    // Keep buffers for retry
  }
}

// Check alert thresholds
function checkAlertThresholds(metric: Metric) {
  if (!config?.alertThresholds) return
  
  config.alertThresholds.forEach(threshold => {
    if (!threshold.enabled || threshold.metric !== metric.name) return
    
    const shouldTrigger = evaluateCondition(metric.value, threshold)
    
    if (shouldTrigger) {
      const existingAlert = alerts.find(a => 
        a.threshold.metric === threshold.metric && !a.resolved
      )
      
      if (!existingAlert) {
        const alert: Alert = {
          id: generateId(),
          threshold,
          currentValue: metric.value,
          triggeredAt: new Date().toISOString(),
          acknowledged: false,
          resolved: false
        }
        alerts.push(alert)
        console.warn(`🚨 Alert triggered: ${threshold.metric} ${threshold.condition} ${threshold.value}`)
      }
    }
  })
}

// Evaluate condition
function evaluateCondition(value: number, threshold: AlertThreshold): boolean {
  switch (threshold.condition) {
    case 'greater_than': return value > threshold.value
    case 'less_than': return value < threshold.value
    case 'equals': return value === threshold.value
    case 'not_equals': return value !== threshold.value
    default: return false
  }
}

// System health monitoring
function startHealthCheck() {
  setInterval(async () => {
    try {
      const startTime = Date.now()
      
      // Check API health
      const apiResponse = await fetch('/api/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      // Check memory usage (Node.js only)
      const memoryUsage = typeof process !== 'undefined' && process.memoryUsage ?
        Math.round((process.memoryUsage.heapUsed / process.memoryUsage.heapTotal) * 100) :
        0
      
      // Check uptime
      const uptime = process.uptime()
      
      // Calculate response time
      const responseTime = Date.now() - startTime
      
      health = {
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime,
        responseTime,
        errorRate: errorsBuffer.length,
        activeUsers: 0, // TODO: Implement user session tracking
        memoryUsage,
        cpuUsage: 0, // TODO: Implement CPU monitoring
        databaseConnections: 0, // TODO: Implement DB connection monitoring
        cacheHitRate: 0, // TODO: Implement cache monitoring
        lastCheck: {
          api: apiResponse.ok ? 'ok' : 'error',
          database: 'ok', // TODO: Implement DB health check
          cache: 'ok', // TODO: Implement cache health check
          storage: 'ok' // TODO: Implement storage health check
        }
      }
      
      recordMetric('health_status', health.status === 'healthy' ? 1 : 0, 'gauge')
      recordMetric('response_time', responseTime, 'timing')
      recordMetric('memory_usage', memoryUsage, 'gauge')
      
    } catch (error) {
      health = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: health?.uptime || 0,
        responseTime: 0,
        errorRate: errorsBuffer.length,
        activeUsers: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        databaseConnections: 0,
        cacheHitRate: 0,
        lastCheck: {
          api: 'error' as const,
          database: 'ok' as const,
          cache: 'ok' as const,
          storage: 'ok' as const
        }
      }
    }
  }, 30000) // Every 30 seconds
}

// Get monitoring data
export function getMonitoringData() {
  return {
    metrics: metricsBuffer,
    errors: errorsBuffer,
    logs: logsBuffer.slice(-100), // Last 100 logs
    performance: performanceBuffer,
    alerts: alerts.filter(a => !a.resolved),
    health: health || {
      status: 'unknown',
      timestamp: new Date().toISOString(),
      uptime: 0,
      responseTime: 0,
      errorRate: 0,
      activeUsers: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      databaseConnections: 0,
      cacheHitRate: 0,
      lastCheck: { api: 'unknown', database: 'unknown', cache: 'unknown', storage: 'unknown' }
    }
  }
}

// Acknowledge alert
export function acknowledgeAlert(alertId: string, userId: string) {
  const alert = alerts.find(a => a.id === alertId)
  if (alert) {
    alert.acknowledged = true
    alert.acknowledgedBy = userId
    alert.acknowledgedAt = new Date().toISOString()
  }
}

// Resolve alert
export function resolveAlert(alertId: string) {
  const alert = alerts.find(a => a.id === alertId)
  if (alert) {
    alert.resolved = true
    alert.resolvedAt = new Date().toISOString()
  }
}

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}

// Cleanup
export function cleanupMonitoring() {
  flushBuffers()
  isInitialized = false
}

// Web Vitals specific functions
export function trackWebVital(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor' = 'good') {
  if (!config?.enableWebVitals) return
  
  recordPerformanceMetric({
    name: `web_vital_${name}`,
    value,
    url: typeof window !== 'undefined' ? window.location.href : '',
    metadata: {
      rating,
      category: name === 'lcp' ? 'loading' : name === 'fid' ? 'interactivity' : 'visual_stability'
    }
  })
  
  recordMetric(`web_vital_${name}`, value, 'timing', { rating })
}

// User interaction tracking
export function trackUserInteraction(type: 'click' | 'scroll' | 'form_submit' | 'page_view') {
  if (!config?.enableUserInteractionTracking) return
  
  recordMetric('user_interaction_total', 1, 'counter', { type })
}