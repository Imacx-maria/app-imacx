"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { JobStatusHunter } from "./JobStatusHunter";
import { Search, X } from "lucide-react";

interface StatusHunterPanelProps {
  triggerClassName?: string;
}

export function StatusHunterPanel({
  triggerClassName,
}: StatusHunterPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className={triggerClassName}
        title="Pesquisar estado de producao"
      >
        <Search className="h-4 w-4" />
      </Button>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col [&>button]:hidden"
      >
        <SheetHeader className="p-4 bg-primary relative">
          {/* Close button - uses primary-foreground (black) on yellow bg */}
          <SheetClose className="absolute right-4 top-4 p-1.5 bg-primary hover:bg-primary/80 transition-colors">
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar</span>
          </SheetClose>
          <SheetTitle className="text-primary-foreground uppercase pr-8">
            Estado da Producao
          </SheetTitle>
          <SheetDescription className="text-primary-foreground/70">
            Pesquise por FO, ORC, Cliente, Campanha ou Item
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <JobStatusHunter className="h-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Floating action button variant for production pages
export function StatusHunterFAB() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        size="icon"
        title="Pesquisar estado de producao"
      >
        <Search className="h-6 w-6" />
      </Button>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col [&>button]:hidden"
      >
        <SheetHeader className="p-4 bg-primary relative">
          {/* Close button - uses primary-foreground (black) on yellow bg */}
          <SheetClose className="absolute right-4 top-4 p-1.5 bg-primary hover:bg-primary/80 transition-colors">
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar</span>
          </SheetClose>
          <SheetTitle className="text-primary-foreground uppercase pr-8">
            Estado da Producao
          </SheetTitle>
          <SheetDescription className="text-primary-foreground/70">
            Pesquise por FO, ORC, Cliente, Campanha ou Item
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <JobStatusHunter className="h-full" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
