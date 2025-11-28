"use client";

import { JobStatusHunter } from "@/components/chat/JobStatusHunter";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export default function MobileStatusPage() {
  const router = useRouter();

  return (
    <main className="h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <header className="imx-border-b p-4 bg-primary relative">
        <h1 className="text-lg font-medium text-primary-foreground text-center uppercase">
          Estado da Producao
        </h1>
        {/* Close button - uses primary-foreground (black) on yellow bg */}
        <button
          onClick={() => router.back()}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 bg-primary hover:bg-primary/80 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden">
        <JobStatusHunter className="h-full" />
      </div>
    </main>
  );
}
