"use client";

import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Calendar } from "lucide-react";

interface MobileDateJob {
  id: string;
  numero_fo: string;
  numero_orc: string | null;
  cliente: string;
  nome_campanha: string;
}

interface MobileDateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  jobs: MobileDateJob[];
}

export function MobileDateDrawer({
  isOpen,
  onClose,
  date,
  jobs,
}: MobileDateDrawerProps) {
  if (!date) return null;

  const formattedDate = format(date, "d MMMM yyyy", { locale: pt }).toUpperCase();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 bg-primary imx-border-b">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-foreground" />
            <SheetTitle className="text-primary-foreground uppercase text-lg">
              {formattedDate}
            </SheetTitle>
          </div>
          <SheetDescription className="text-primary-foreground/70">
            {jobs.length} {jobs.length === 1 ? "trabalho" : "trabalhos"} nesta data
          </SheetDescription>
        </SheetHeader>

        {/* Jobs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {jobs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Sem trabalhos para esta data
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="imx-border bg-card p-4"
              >
                {/* FO and ORC row */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">
                    {job.numero_fo ? `FO ${job.numero_fo}` : "—"}
                  </span>
                  {job.numero_orc && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">
                        ORC {job.numero_orc}
                      </span>
                    </>
                  )}
                </div>

                {/* Cliente */}
                <div className="mb-1">
                  <span className="text-xs text-muted-foreground uppercase block">
                    Cliente
                  </span>
                  <span className="text-sm">{job.cliente || "—"}</span>
                </div>

                {/* Campanha */}
                <div>
                  <span className="text-xs text-muted-foreground uppercase block">
                    Campanha
                  </span>
                  <span className="text-sm">{job.nome_campanha || "—"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
