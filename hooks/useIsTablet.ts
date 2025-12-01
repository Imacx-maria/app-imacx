import { useState, useEffect } from "react";

const TABLET_BREAKPOINT_MIN = 768; // md breakpoint in Tailwind
const TABLET_BREAKPOINT_MAX = 1023; // lg - 1 in Tailwind

export function useIsTablet(): boolean {
  // Always start with false to match SSR
  const [isTablet, setIsTablet] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mark as mounted first to prevent hydration mismatch
    setIsMounted(true);
    
    // Check initial value
    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= TABLET_BREAKPOINT_MIN && width < TABLET_BREAKPOINT_MAX);
    };

    // Set initial value after mount
    checkTablet();

    // Listen for resize events
    window.addEventListener("resize", checkTablet);

    return () => {
      window.removeEventListener("resize", checkTablet);
    };
  }, []);

  // Return false during SSR and initial client render to prevent hydration mismatch
  if (!isMounted) {
    return false;
  }

  return isTablet;
}

