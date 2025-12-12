"use client";

import { useState, useCallback } from "react";
import { PagePermissionGuard } from "@/components/PagePermissionGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tab components (lazy loaded for performance)
import EmployeesTab from "@/components/ferias/EmployeesTab";
import AbsencesTab from "@/components/ferias/AbsencesTab";
import CalendarTab from "@/components/ferias/CalendarTab";
import ReportsTab from "@/components/ferias/ReportsTab";
import DefinitionsTab from "@/components/ferias/DefinitionsTab";

export default function FeriasPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  // Key to force re-mount of tabs that need fresh data
  const [refreshKey, setRefreshKey] = useState(0);

  // Called when data changes in any tab (absences, employees)
  const handleDataChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <PagePermissionGuard pageId="ferias">
      <div className="w-full space-y-6 p-4 md:p-8">
        <div>
          <h1 className="text-2xl">GESTAO DE FERIAS E AUSENCIAS</h1>
          <p className="text-muted-foreground mt-2">
            Gerir colaboradores, ferias, ausencias e calendario
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full">
            <TabsTrigger value="employees" className="flex-1">Colaboradores</TabsTrigger>
            <TabsTrigger value="absences" className="flex-1">Ausencias</TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1">Calendario</TabsTrigger>
            <TabsTrigger value="reports" className="flex-1">Relatorios</TabsTrigger>
            <TabsTrigger value="rules" className="flex-1">DEFINIÇÕES</TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-4 mt-6">
            <EmployeesTab onDataChange={handleDataChange} />
          </TabsContent>

          <TabsContent value="absences" className="space-y-4 mt-6">
            <AbsencesTab onDataChange={handleDataChange} />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4 mt-6">
            <CalendarTab key={`calendar-${refreshKey}`} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4 mt-6">
            <ReportsTab key={`reports-${refreshKey}`} />
          </TabsContent>

          <TabsContent value="rules" className="space-y-4 mt-6">
            <DefinitionsTab onDataChange={handleDataChange} />
          </TabsContent>
        </Tabs>
      </div>
    </PagePermissionGuard>
  );
}
