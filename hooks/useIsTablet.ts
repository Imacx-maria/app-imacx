import { useState, useEffect } from "react";

const TABLET_BREAKPOINT_MIN = 768; // md breakpoint in Tailwind
const TABLET_BREAKPOINT_MAX = 1023; // lg - 1 in Tailwind

export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    // Check initial value
    const checkTablet = () => {
      const width = window.innerWidth;
      setIsTablet(width >= TABLET_BREAKPOINT_MIN && width < TABLET_BREAKPOINT_MAX);
    };

    // Set initial value
    checkTablet();

    // Listen for resize events
    window.addEventListener("resize", checkTablet);

    return () => {
      window.removeEventListener("resize", checkTablet);
    };
  }, []);

  return isTablet;
}

