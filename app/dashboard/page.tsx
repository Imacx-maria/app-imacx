"use client";

import { useState, lazy, Suspense } from "react";
import { FullYearCalendar } from "@/components/FullYearCalendar";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddDeliveryDialog } from "@/components/AddDeliveryDialog";
import { DashboardTableSkeleton } from "@/components/dashboard/DashboardTableSkeleton";
import { DashboardHelpDialog } from "@/components/dashboard/DashboardHelpDialog";
import { useDashboardData } from "./hooks/useDashboardData";
import { useIsMobile } from "@/hooks/useIsMobile";

const DashboardLogisticaTable = lazy(
  () => import("@/components/DashboardLogisticaTable"),
);

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const {
    armazens,
    transportadoras,
    holidays,
    clientes,
    fetchArmazens,
    fetchTransportadoras,
    fetchClientes,
  } = useDashboardData();

  return (
    <div className="w-full space-y-8 px-2 md:px-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl text-center md:text-left">
            {isMobile ? "Calendário" : "Painel de Controlo"}
          </h1>
          <p className="mt-2 hidden md:block">
            Bem-vindo ao Sistema de Gestão de Produção IMACX
          </p>
        </div>
        {/* Action buttons - hidden on mobile */}
        <div className="hidden md:flex items-center gap-2">
          <DashboardHelpDialog />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Entrega
                </Button>
              </TooltipTrigger>
              <TooltipContent>Adicionar Nova Entrega</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Calendar Section */}
      <div className="space-y-8">
        <div className="w-full">
          <div className="p-0 md:p-4 text-card-foreground">
            <h2 className="mb-4 font-semibold hidden md:block">Calendário</h2>
            <FullYearCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              holidays={holidays}
            />
          </div>
        </div>

        {/* Table Section - hidden on mobile unless date selected */}
        {(!isMobile || selectedDate) && (
          <div className="w-full">
            <div className="p-0 md:p-4 text-card-foreground">
              <Suspense fallback={<DashboardTableSkeleton />}>
                <DashboardLogisticaTable
                  key={refreshKey}
                  selectedDate={selectedDate}
                  onClearDate={() => setSelectedDate(undefined)}
                  armazens={armazens}
                  transportadoras={transportadoras}
                  clientes={clientes}
                  onArmazensUpdate={fetchArmazens}
                  onTransportadorasUpdate={fetchTransportadoras}
                  onClientesUpdate={fetchClientes}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      <AddDeliveryDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => setRefreshKey((prev) => prev + 1)}
        armazens={armazens}
        transportadoras={transportadoras}
      />
    </div>
  );
}
