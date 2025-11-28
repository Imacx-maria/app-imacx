"use client";

/**
 * ItemDrawerContent Component
 * Manages the drawer content for viewing/editing production item operations
 */

import React, { useState, useCallback, useEffect, useMemo, memo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Loader2 } from "lucide-react";
import { logOperationCreation } from "@/utils/auditLogging";
import { CorteLoosePlatesTable } from "../CorteLoosePlatesTable";
import { ImpressaoOperationsTable } from "./ImpressaoOperationsTable";
import { CorteFromPrintTable } from "./CorteFromPrintTable";
import type { ItemDrawerProps, ProductionOperation } from "../../types";

function ItemDrawerContentInner({
  itemId,
  items,
  onClose,
  supabase,
  onMainRefresh,
}: ItemDrawerProps) {
  const item = items.find((i) => i.id === itemId);
  const [operations, setOperations] = useState<ProductionOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [designerPlanos, setDesignerPlanos] = useState<any[]>([]);
  const [importingPlanos, setImportingPlanos] = useState(false);

  const fetchOperations = useCallback(async () => {
    if (!item) return;

    setLoading(true);
    try {
      const { data: operationsData, error } = await supabase
        .from("producao_operacoes")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching operations:", error);
      } else {
        setOperations(operationsData || []);
      }
    } catch (error) {
      console.error("Error fetching operations:", error);
    } finally {
      setLoading(false);
    }
  }, [item, supabase]);

  const fetchDesignerPlanos = useCallback(async () => {
    if (!item) return;

    try {
      const { data, error } = await supabase
        .from("designer_planos")
        .select("*")
        .eq("item_id", item.id)
        .eq("criado_em_producao", false)
        .order("plano_ordem", { ascending: true });

      if (!error && data) {
        setDesignerPlanos(data);
      }
    } catch (error) {
      console.error("Error fetching designer planos:", error);
    }
  }, [item, supabase]);

  useEffect(() => {
    fetchOperations();
    fetchDesignerPlanos();
  }, [fetchOperations, fetchDesignerPlanos]);

  const handleImportPlanos = useCallback(async () => {
    if (!item || designerPlanos.length === 0) return;

    setImportingPlanos(true);
    try {
      let importedCount = 0;

      // Fetch all machines to map names to IDs
      const { data: machinesData } = await supabase
        .from("maquinas_operacao")
        .select("id, nome_maquina");

      const machineNameToId = new Map<string, string>();
      if (machinesData) {
        machinesData.forEach((m: any) => {
          machineNameToId.set(m.nome_maquina.toUpperCase(), m.id);
        });
      }

      for (const plano of designerPlanos) {
        const now = new Date();
        const dateStr = format(now, "yyyyMMdd");
        const timeStr = format(now, "HHmmss");
        const foShort = item.folhas_obras?.numero_fo?.substring(0, 6) || "FO";
        const typePrefix =
          plano.tipo_operacao === "Impressao"
            ? "IMP"
            : plano.tipo_operacao === "Impressao_Flexiveis"
              ? "FLX"
              : "CRT";
        const no_interno = `${foShort}-${dateStr}-${typePrefix}-${timeStr}-${plano.plano_ordem}`;

        // Handle legacy planos: if maquina is not a UUID, look up by name
        let maquinaId = plano.maquina;
        if (
          plano.maquina &&
          !plano.maquina.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          )
        ) {
          maquinaId = machineNameToId.get(plano.maquina.toUpperCase()) || null;
        }

        const USE_NEW_FIELDS = true;

        const baseData = {
          item_id: itemId,
          folha_obra_id: item.folha_obra_id,
          Tipo_Op: plano.tipo_operacao,
          plano_nome: plano.plano_nome,
          material_id: plano.material_id,
          cores: plano.cores,
          data_operacao: new Date().toISOString().split("T")[0],
          no_interno,
          notas_imp: plano.notas,
          QT_print: plano.quantidade,
          concluido: false,
        };

        const printJobId =
          plano.tipo_operacao === "Impressao" ||
          plano.tipo_operacao === "Impressao_Flexiveis"
            ? crypto.randomUUID()
            : null;
        const cutJobId =
          plano.tipo_operacao === "Corte" ? crypto.randomUUID() : null;

        const operationData = USE_NEW_FIELDS
          ? {
              ...baseData,
              is_source_record: true,
              qt_print_planned:
                plano.tipo_operacao === "Impressao" ||
                plano.tipo_operacao === "Impressao_Flexiveis"
                  ? plano.quantidade
                  : null,
              qt_corte_planned:
                plano.tipo_operacao === "Corte" ? plano.quantidade : null,
              print_job_id: printJobId,
              cut_job_id: cutJobId,
              num_placas_print:
                plano.tipo_operacao === "Impressao" ||
                plano.tipo_operacao === "Impressao_Flexiveis"
                  ? plano.quantidade
                  : 0,
              num_placas_corte:
                plano.tipo_operacao === "Corte" ? plano.quantidade : 0,
              maquina: null,
              operador_id: null,
            }
          : {
              ...baseData,
              num_placas_print:
                plano.tipo_operacao === "Impressao" ||
                plano.tipo_operacao === "Impressao_Flexiveis"
                  ? plano.quantidade
                  : 0,
              num_placas_corte:
                plano.tipo_operacao === "Corte" ? plano.quantidade : 0,
              maquina: maquinaId,
            };

        const { data: savedOp, error: opError } = await supabase
          .from("producao_operacoes")
          .insert([operationData])
          .select()
          .single();

        if (opError) {
          console.error("Error inserting operation:", opError);
          continue;
        }

        if (savedOp) {
          // Mark plano as created
          await supabase
            .from("designer_planos")
            .update({
              criado_em_producao: true,
              producao_operacao_id: savedOp.id,
            })
            .eq("id", plano.id);

          // Log operation creation
          await logOperationCreation(supabase, savedOp.id, operationData);

          // If Impressao, create linked Corte
          if (
            plano.tipo_operacao === "Impressao" ||
            plano.tipo_operacao === "Impressao_Flexiveis"
          ) {
            const corteNoInterno = `${no_interno}-CORTE`;
            const corteData = USE_NEW_FIELDS
              ? {
                  Tipo_Op: "Corte",
                  item_id: itemId,
                  folha_obra_id: item.folha_obra_id,
                  data_operacao: new Date().toISOString().split("T")[0],
                  no_interno: corteNoInterno,
                  source_impressao_id: savedOp.id,
                  material_id: plano.material_id,
                  plano_nome: plano.plano_nome,
                  cores: plano.cores,
                  is_source_record: true,
                  qt_corte_planned: plano.quantidade,
                  cut_job_id: crypto.randomUUID(),
                  num_placas_corte: plano.quantidade,
                  operador_id: null,
                  maquina: null,
                  concluido: false,
                  QT_print: plano.quantidade || 0,
                }
              : {
                  Tipo_Op: "Corte",
                  item_id: itemId,
                  folha_obra_id: item.folha_obra_id,
                  data_operacao: new Date().toISOString().split("T")[0],
                  no_interno: corteNoInterno,
                  num_placas_corte: 0,
                  QT_print: plano.quantidade || 0,
                  source_impressao_id: savedOp.id,
                  material_id: plano.material_id,
                  plano_nome: plano.plano_nome,
                  cores: plano.cores,
                  concluido: false,
                };

            const { data: corteOp, error: corteError } = await supabase
              .from("producao_operacoes")
              .insert([corteData])
              .select()
              .single();

            if (!corteError && corteOp) {
              await logOperationCreation(supabase, corteOp.id, corteData);
            }
          }

          importedCount++;
        }
      }

      if (importedCount > 0) {
        alert(`${importedCount} planos importados com sucesso!`);
        fetchOperations();
        fetchDesignerPlanos();
        onMainRefresh();
      } else {
        alert("Nenhum plano foi importado. Verifique a consola para erros.");
      }
    } catch (error) {
      console.error("Error importing planos:", error);
      alert(`Erro ao importar planos: ${error}`);
    } finally {
      setImportingPlanos(false);
    }
  }, [item, itemId, designerPlanos, supabase, fetchOperations, fetchDesignerPlanos, onMainRefresh]);

  if (!item) return null;

  const impressaoOperations = operations.filter(
    (op) => op.Tipo_Op === "Impressao"
  );
  const corteOperations = operations.filter((op) => op.Tipo_Op === "Corte");

  return (
    <div className="relative space-y-6 p-6">
      {/* Close button and Quantity */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
        <div className="text-right">
          <div className="text-xs uppercase">Quantidade</div>
          <div className="font-mono text-lg">{item.quantidade}</div>
        </div>
        <Button size="icon" variant="outline" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Item info */}
      <div className="mb-6 p-4 uppercase">
        <div className="mb-2 flex items-center gap-8">
          <div>
            <div className="text-xs uppercase">FO</div>
            <div className="font-mono">{item.folhas_obras?.numero_fo}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs uppercase">Campanha</div>
            <div className="truncate font-mono">
              {item.folhas_obras?.nome_campanha}
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase">Item</div>
          <div className="font-mono">{item.descricao}</div>
        </div>
      </div>

      {/* Import Planos Button */}
      {designerPlanos.length > 0 && (
        <div className="mb-4 rounded-lg imx-border bg-info/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-info-foreground">
                Planos Disponíveis do Designer
              </h4>
              <p className="text-sm text-info-foreground/80">
                {designerPlanos.length} plano
                {designerPlanos.length > 1 ? "s" : ""} pronto
                {designerPlanos.length > 1 ? "s" : ""} para importar
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {designerPlanos.map((plano: any) => (
                  <Badge
                    key={plano.id}
                    variant="secondary"
                    className="font-mono"
                  >
                    {plano.plano_nome}: {plano.tipo_operacao} -{" "}
                    {plano.quantidade || 0} placas
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              onClick={handleImportPlanos}
              disabled={importingPlanos}
              className="bg-info text-info-foreground hover:bg-info/90"
            >
              {importingPlanos ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Importar Planos
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs for different operation types */}
      <Tabs defaultValue="impressao" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="impressao">
            Impressão ({impressaoOperations.length})
          </TabsTrigger>
          <TabsTrigger value="corte_impressao">
            Corte de Impressões (
            {corteOperations.filter((op) => op.source_impressao_id).length})
          </TabsTrigger>
          <TabsTrigger value="corte_chapas">
            Operações de Corte (Chapas Soltas) (
            {corteOperations.filter((op) => !op.source_impressao_id).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="impressao">
          <ImpressaoOperationsTable
            operations={impressaoOperations}
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            item={item}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>

        <TabsContent value="corte_impressao">
          <CorteFromPrintTable
            operations={corteOperations.filter((op) => op.source_impressao_id)}
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>

        <TabsContent value="corte_chapas">
          <CorteLoosePlatesTable
            operations={corteOperations.filter((op) => !op.source_impressao_id)}
            itemId={item.id}
            folhaObraId={item.folha_obra_id}
            item={item}
            supabase={supabase}
            onRefresh={fetchOperations}
            onMainRefresh={onMainRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
export const ItemDrawerContent = memo(ItemDrawerContentInner);
