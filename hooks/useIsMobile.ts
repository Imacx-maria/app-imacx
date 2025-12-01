import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768; // md breakpoint in Tailwind
const DESKTOP_BREAKPOINT = 1024; // lg breakpoint in Tailwind

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check initial value
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Set initial value
    checkMobile();

    // Listen for resize events
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile;
}

/**
 * Returns true if the screen is mobile OR tablet (anything below desktop breakpoint)
 * Desktop breakpoint: 1024px (lg in Tailwind)
 */
export function useIsMobileOrTablet(): boolean {
  // Always start with false to match SSR
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mark as mounted first to prevent hydration mismatch
    setIsMounted(true);
    
    // Check initial value
    const checkMobileOrTablet = () => {
      setIsMobileOrTablet(window.innerWidth < DESKTOP_BREAKPOINT);
    };

    // Set initial value after mount
    checkMobileOrTablet();

    // Listen for resize events
    window.addEventListener("resize", checkMobileOrTablet);

    return () => {
      window.removeEventListener("resize", checkMobileOrTablet);
    };
  }, []);

  // Return false during SSR and initial client render to prevent hydration mismatch
  if (!isMounted) {
    return false;
  }

  return isMobileOrTablet;
}

/**
 * Returns true if the screen is in the small desktop range (1025px - 1270px)
 * In this range, we hide some columns like Item and Cliente
 */
export function useIsSmallDesktop(): boolean {
  // Always start with false to match SSR
  const [isSmallDesktop, setIsSmallDesktop] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mark as mounted first to prevent hydration mismatch
    setIsMounted(true);
    
    // Check initial value
    const checkSmallDesktop = () => {
      const width = window.innerWidth;
      setIsSmallDesktop(width >= 1025 && width < 1271);
    };

    // Set initial value after mount
    checkSmallDesktop();

    // Listen for resize events
    window.addEventListener("resize", checkSmallDesktop);

    return () => {
      window.removeEventListener("resize", checkSmallDesktop);
    };
  }, []);

  // Return false during SSR and initial client render to prevent hydration mismatch
  if (!isMounted) {
    return false;
  }

  return isSmallDesktop;
}
