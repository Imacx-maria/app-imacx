/**
 * Performance monitoring utilities for measuring page load times
 */

export interface PerformanceMetrics {
  page: string;
  timestamp: number;
  // Navigation Timing API metrics
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  // Calculated metrics
  domContentLoadedTime: number; // Time until DOMContentLoaded
  loadCompleteTime: number; // Time until load event
  // Resource timing
  resources: ResourceTiming[];
  // Web Vitals (if available)
  webVitals?: {
    FCP?: number; // First Contentful Paint
    LCP?: number; // Largest Contentful Paint
    FID?: number; // First Input Delay
    CLS?: number; // Cumulative Layout Shift
    TTFB?: number; // Time to First Byte
  };
}

export interface ResourceTiming {
  name: string;
  duration: number;
  size: number;
  type: string;
}

/**
 * Collects performance metrics for the current page
 */
export function collectPerformanceMetrics(pagePath: string): PerformanceMetrics {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  const metrics: PerformanceMetrics = {
    page: pagePath,
    timestamp: Date.now(),
    navigationStart: navigation.startTime,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
    loadComplete: navigation.loadEventEnd - navigation.startTime,
    domContentLoadedTime: navigation.domContentLoadedEventEnd - navigation.startTime,
    loadCompleteTime: navigation.loadEventEnd - navigation.startTime,
    resources: resources.map((resource) => ({
      name: resource.name,
      duration: resource.duration,
      size: (resource as any).transferSize || 0,
      type: resource.initiatorType,
    })),
  };

  // Try to get Web Vitals if available
  if (typeof window !== 'undefined' && (window as any).webVitals) {
    const vitals = (window as any).webVitals;
    metrics.webVitals = {
      FCP: vitals.FCP,
      LCP: vitals.LCP,
      FID: vitals.FID,
      CLS: vitals.CLS,
      TTFB: vitals.TTFB,
    };
  }

  return metrics;
}

/**
 * Measures time until a specific event or condition
 */
export function measureUntil(
  condition: () => boolean,
  timeout: number = 10000
): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const checkInterval = 100; // Check every 100ms
    let elapsed = 0;

    const check = () => {
      if (condition()) {
        resolve(performance.now() - startTime);
        return;
      }

      elapsed += checkInterval;
      if (elapsed >= timeout) {
        reject(new Error(`Timeout: condition not met within ${timeout}ms`));
        return;
      }

      setTimeout(check, checkInterval);
    };

    check();
  });
}

/**
 * Measures time until page is interactive (no loading indicators)
 */
export function measurePageInteractive(): Promise<number> {
  return measureUntil(() => {
    // Check if there are no loading spinners or skeletons visible
    const loadingElements = document.querySelectorAll('[data-loading="true"], .loading, .skeleton');
    return loadingElements.length === 0;
  }, 30000);
}

/**
 * Gets all resource load times grouped by type
 */
export function getResourceLoadTimes(): Record<string, { count: number; totalTime: number; avgTime: number }> {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const grouped: Record<string, { count: number; totalTime: number; avgTime: number }> = {};

  resources.forEach((resource) => {
    const type = resource.initiatorType;
    if (!grouped[type]) {
      grouped[type] = { count: 0, totalTime: 0, avgTime: 0 };
    }
    grouped[type].count++;
    grouped[type].totalTime += resource.duration;
  });

  Object.keys(grouped).forEach((type) => {
    grouped[type].avgTime = grouped[type].totalTime / grouped[type].count;
  });

  return grouped;
}

/**
 * Gets slowest resources
 */
export function getSlowestResources(limit: number = 10): ResourceTiming[] {
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  return resources
    .map((resource) => ({
      name: resource.name,
      duration: resource.duration,
      size: (resource as any).transferSize || 0,
      type: resource.initiatorType,
    }))
    .sort((a, b) => b.duration - a.duration)
    .slice(0, limit);
}

