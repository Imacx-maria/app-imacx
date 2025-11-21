"use client"

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { collectPerformanceMetrics } from '@/utils/performance'

/**
 * Performance monitoring component that tracks page load times
 * Add this to your layout to automatically track all pages
 */
export function PerformanceMonitor() {
  const pathname = usePathname()

  useEffect(() => {
    // Wait for page to be fully loaded
    const measurePerformance = () => {
      // Small delay to ensure all resources are loaded
      setTimeout(() => {
        const metrics = collectPerformanceMetrics(pathname)
        
        // Store metrics in localStorage for audit script to collect
        const existingAudits = JSON.parse(
          localStorage.getItem('performanceAudits') || '[]'
        )
        existingAudits.push(metrics)
        localStorage.setItem('performanceAudits', JSON.stringify(existingAudits))
        
        // Also log to console in dev mode
        if (process.env.NODE_ENV === 'development') {
          console.log(`📊 Performance metrics for ${pathname}:`, {
            'DOM Content Loaded': `${metrics.domContentLoadedTime.toFixed(2)}ms`,
            'Load Complete': `${metrics.loadCompleteTime.toFixed(2)}ms`,
            'Resources': metrics.resources.length,
          })
        }
      }, 1000) // Wait 1 second after navigation to capture all metrics
    }

    // Measure on mount and pathname change
    if (typeof window !== 'undefined') {
      measurePerformance()
    }
  }, [pathname])

  return null // This component doesn't render anything
}

