"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConflictRulesTab from "@/components/ferias/ConflictRulesTab";
import DepartamentosManager from "@/components/ferias/definitions/DepartamentosManager";
import FeriadosManager from "@/components/ferias/definitions/FeriadosManager";
import SituationTypesManager from "@/components/ferias/definitions/SituationTypesManager";

interface DefinitionsTabProps {
  onDataChange?: () => void;
}

export default function DefinitionsTab({ onDataChange }: DefinitionsTabProps) {
  return (
    <Tabs defaultValue="rules" className="w-full space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="rules">Regras</TabsTrigger>
        <TabsTrigger value="situation-types">Tipos de Situaçao</TabsTrigger>
        <TabsTrigger value="feriados">Feriados</TabsTrigger>
        <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
      </TabsList>

      <TabsContent value="rules" className="space-y-4">
        <ConflictRulesTab onDataChange={onDataChange} />
      </TabsContent>

      <TabsContent value="situation-types" className="space-y-4">
        <SituationTypesManager />
      </TabsContent>

      <TabsContent value="feriados" className="space-y-4">
        <FeriadosManager />
      </TabsContent>

      <TabsContent value="departamentos" className="space-y-4">
        <DepartamentosManager />
      </TabsContent>
    </Tabs>
  );
}
