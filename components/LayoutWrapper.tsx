"use client";

import { usePathname } from "next/navigation";
import { Navigation } from "./Navigation";
import { Header } from "./Header";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNavigation =
    pathname === "/login" || pathname?.startsWith("/mobile");

  if (hideNavigation) {
    return (
      <div className="min-h-screen bg-background">
        <main className="bg-background">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - hidden on mobile (< md) */}
      <div className="hidden md:block">
        <Navigation />
      </div>
      <main className="flex-1 bg-background overflow-auto w-full">
        <div className="flex flex-col h-full">
          {/* Header - always visible (has logo + search) */}
          <Header />

          {/* Page Content */}
          <div className="flex-1 p-4 md:p-6">
            <div className="max-w-[1600px] mx-auto">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
