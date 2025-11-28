"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import Link from "next/link";
import { StatusHunterPanel } from "./chat/StatusHunterPanel";

export function Header() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use resolvedTheme if available, otherwise fall back to theme
  const currentTheme = mounted ? (resolvedTheme || theme) : "light";
  const logoSrc = currentTheme === "dark" ? "/imacx_neg.svg" : "/imacx_pos.svg";

  return (
    <div className="flex justify-between items-center px-6 py-4 sticky top-0 z-10 bg-background">
      {/* Status Hunter Button */}
      <StatusHunterPanel />

      {/* Logo - Top Right */}
      <Link
        href="/dashboard"
        className="cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
      >
        <img
          src={logoSrc}
          alt="IMACX Logo"
          width={120}
          height={30}
          style={{ display: "block", maxWidth: "120px", height: "auto" }}
        />
      </Link>
    </div>
  );
}

