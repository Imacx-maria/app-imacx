"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Combobox from "@/components/ui/Combobox";
import { createBrowserClient } from "@/utils/supabase";
import type { NewExecutionFormProps, ExecutionFormData } from "./types";

// Role IDs for operators
const ROLE_IDS = {
  corte: "968afe0b-0b14-46b2-9269-4fc9f120bbfa",
  impressao: "2e18fb9d-52ef-4216-90ea-699372cd5a87",
};

interface OperatorOption {
  value: string;
  label: string;
}

interface MachineOption {
  value: string;
  label: string;
}

export function NewExecutionForm({
  planoId,
  planoNome,
  operationType,
  quantidadeDisponivel,
  onSubmit,
  onCancel,
  loading = false,
}: NewExecutionFormProps) {
  const supabase = useMemo(() => createBrowserClient(), []);
  
  // Data from database
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [maquinaId, setMaquinaId] = useState("");
  const [operadorId, setOperadorId] = useState("");
  const [quantidade, setQuantidade] = useState<number>(1);
  const [notas, setNotas] = useState("");

  // Fetch machines and operators
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        // Fetch machines from maquinas_operacao
        const { data: machinesData, error: machinesError } = await supabase
          .from("maquinas_operacao")
          .select("id, nome_maquina")
          .eq("ativa", true)
          .order("nome_maquina", { ascending: true });

        if (machinesError) {
          console.error("Error fetching machines:", machinesError);
        } else if (machinesData) {
          setMachines(machinesData.map(m => ({
            value: m.id,
            label: m.nome_maquina,
          })));
        }

        // Determine which role to use based on operation type
        const roleId = operationType === "Corte" ? ROLE_IDS.corte : ROLE_IDS.impressao;

        // Fetch operators with specific role
        const { data: operatorsData, error: operatorsError } = await supabase
          .from("profiles")
          .select("id, first_name")
          .eq("role_id", roleId)
          .order("first_name", { ascending: true });

        if (operatorsError) {
          console.error("Error fetching operators:", operatorsError);
        } else if (operatorsData) {
          setOperators(operatorsData.map(o => ({
            value: o.id,
            label: o.first_name,
          })));
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [supabase, operationType]);

  // Get selected operator name
  const selectedOperatorName = useMemo(() => {
    const op = operators.find(o => o.value === operadorId);
    return op?.label || "";
  }, [operators, operadorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!maquinaId || !operadorId || quantidade <= 0) {
      return;
    }

    const data: ExecutionFormData = {
      maquina: maquinaId, // UUID - drawer will resolve to name
      operador_id: operadorId,
      operador_nome: selectedOperatorName,
      quantidade_executada: quantidade,
      notas: notas || undefined,
    };

    await onSubmit(data);
  };

  if (loadingData) {
    return (
      <Card className="imx-border p-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">A carregar dados...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="imx-border p-4">
      <h4 className="text-sm font-medium mb-4">
        Nova Execução - Plano {planoNome}
      </h4>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Máquina *</Label>
            <Combobox
              value={maquinaId}
              onChange={setMaquinaId}
              options={machines}
              placeholder="Selecionar máquina"
              emptyMessage="Nenhuma máquina encontrada"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label>Operador *</Label>
            <Combobox
              value={operadorId}
              onChange={setOperadorId}
              options={operators}
              placeholder="Selecionar operador"
              emptyMessage="Nenhum operador encontrado"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade">Quantidade *</Label>
            <Input
              id="quantidade"
              type="number"
              min={1}
              max={quantidadeDisponivel}
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
            />
            {quantidadeDisponivel !== undefined && (
              <p className="text-xs text-muted-foreground">
                Restam: {quantidadeDisponivel}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Input
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observações"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} size="sm">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || !maquinaId || !operadorId} size="sm">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registar
          </Button>
        </div>
      </form>
    </Card>
  );
}
