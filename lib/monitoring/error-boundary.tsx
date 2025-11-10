'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import { recordError } from '@/lib/monitoring/core'
import { createEnvironmentLogger } from '@/lib/monitoring/logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const logger = createEnvironmentLogger('error-boundary')

interface Props {
  children: ReactNode
  fallback?: ReactNode
  componentName?: string
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  eventId?: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error,
      eventId: Math.random().toString(36).substr(2, 9)
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { componentName = 'Unknown', onError } = this.props
    
    // Log error with context
    logger.error('Component error caught by boundary', {
      componentName,
      eventId: this.state.eventId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      }
    })

    // Record error in monitoring system
    recordError(error, {
      component: componentName,
      type: 'react_error_boundary',
      eventId: this.state.eventId,
      componentStack: errorInfo.componentStack
    })

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }

    this.setState({ errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, eventId: undefined })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-lg">Oops! Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred in <strong>{this.props.componentName || 'this component'}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {this.props.showDetails && this.state.error && (
                <details className="text-left text-sm bg-muted p-3 rounded">
                  <summary className="cursor-pointer font-medium mb-2">Error Details</summary>
                  <div className="space-y-2">
                    <div>
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="text-xs overflow-auto whitespace-pre-wrap mt-1">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.eventId && (
                      <div>
                        <strong>Event ID:</strong> {this.state.eventId}
                      </div>
                    )}
                  </div>
                </details>
              )}
              <div className="flex gap-2 justify-center">
                <Button onClick={this.handleRetry} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                {process.env.NODE_ENV === 'development' && (
                  <Button 
                    onClick={() => window.location.reload()} 
                    variant="outline"
                  >
                    Reload Page
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    componentName?: string
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
    showDetails?: boolean
  } = {}
) {
  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary
      componentName={options.componentName || WrappedComponent.name}
      fallback={options.fallback}
      onError={options.onError}
      showDetails={options.showDetails}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `withErrorBoundary(${options.componentName || WrappedComponent.name || 'Component'})`
  return WithErrorBoundary
}

// Hook for manual error reporting
export function useErrorHandler(componentName = 'Hook') {
  return (error: Error, context?: Record<string, any>) => {
    logger.error('Manual error report', {
      componentName,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    })

    recordError(error, {
      component: componentName,
      type: 'manual_error',
      context
    })
  }
}