"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, RotateCw, Trash2, ArrowLeft, ArrowRight } from "lucide-react";

const ITEMS_PER_PAGE = 40;

interface SituationTypeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  deducts_vacation: boolean;
  deduction_value: number;
  is_active: boolean;
}

export default function SituationTypesManager() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [rows, setRows] = useState<SituationTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deductsVacation, setDeductsVacation] = useState(false);
  const [deductionValue, setDeductionValue] = useState("1");
  const [isActive, setIsActive] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("situation_types")
        .select(
          "id, code, name, description, deducts_vacation, deduction_value, is_active",
        )
        .order("code", { ascending: true });

      if (fetchError) throw fetchError;
      setRows((data as SituationTypeRow[]) || []);
    } catch (err: any) {
      console.error("Error fetching situation_types:", err);
      setError(err.message || "Erro ao carregar situation types");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleAdd = async () => {
    setError(null);
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedCode) {
      setError("O codigo é obrigatorio.");
      return;
    }
    if (!trimmedName) {
      setError("O nome é obrigatorio.");
      return;
    }

    const parsedDeduction = Number(deductionValue);
    if (deductsVacation && (!Number.isFinite(parsedDeduction) || parsedDeduction <= 0)) {
      setError("Deduction value invalido.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from("situation_types")
        .insert({
          code: trimmedCode,
          name: trimmedName,
          description: trimmedDescription ? trimmedDescription : null,
          deducts_vacation: deductsVacation,
          deduction_value: deductsVacation ? parsedDeduction : 0,
          is_active: isActive,
        });

      if (insertError) throw insertError;

      setCode("");
      setName("");
      setDescription("");
      setDeductsVacation(false);
      setDeductionValue("1");
      setIsActive(true);
      await fetchRows();
    } catch (err: any) {
      console.error("Error creating situation type:", err);
      setError(err.message || "Erro ao criar situation type");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, next: boolean) => {
    setError(null);
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("situation_types")
        .update({ is_active: next })
        .eq("id", id);
      if (updateError) throw updateError;
      await fetchRows();
    } catch (err: any) {
      console.error("Error updating situation type:", err);
      setError(err.message || "Erro ao atualizar situation type");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, typeCode: string) => {
    setError(null);
    if (!confirm(`Eliminar situation type ${typeCode}?`)) return;

    setSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from("situation_types")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      await fetchRows();
    } catch (err: any) {
      console.error("Error deleting situation type:", err);
      setError(
        err.message ||
          "Erro ao eliminar situation type (se estiver em uso, desative).",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm">GESTAO DE SITUATION TYPES</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRows}
            disabled={loading || submitting}
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>Codigo</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="H"
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="FERIAS"
              disabled={submitting}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descriçao (opcional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="EX: FERIAS ANUAIS"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-2">
            <Label>Deduz Ferias</Label>
            <div className="flex items-center gap-3">
              <Switch
                checked={deductsVacation}
                onCheckedChange={setDeductsVacation}
                disabled={submitting}
              />
              <span className="text-xs text-muted-foreground">
                {deductsVacation ? "SIM" : "NAO"}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Deduction Value</Label>
            <Input
              value={deductionValue}
              onChange={(e) => setDeductionValue(e.target.value)}
              disabled={submitting || !deductsVacation}
              placeholder="1"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-2">
            <Label>Ativo</Label>
            <div className="flex items-center gap-3">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={submitting}
              />
              <span className="text-xs text-muted-foreground">
                {isActive ? "SIM" : "NAO"}
              </span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A guardar...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Inserir
                </>
              )}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            A carregar...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registos.</p>
        ) : (
          <>
            <Table className="w-full imx-table-compact">
              <TableHeader>
                <TableRow>
                  <TableHead className="imx-border-b">Codigo</TableHead>
                  <TableHead className="imx-border-b">Nome</TableHead>
                  <TableHead className="imx-border-b">Deduz</TableHead>
                  <TableHead className="imx-border-b">Valor</TableHead>
                  <TableHead className="imx-border-b">Ativo</TableHead>
                  <TableHead className="text-right imx-border-b">Açao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
                  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                  const paginatedRows = rows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                  
                  return paginatedRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.deducts_vacation ? "SIM" : "NAO"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.deduction_value}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(next) => handleToggleActive(r.id, next)}
                      disabled={submitting}
                      aria-label={`${r.code} ativo`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(r.id, r.code)}
                      disabled={submitting}
                      aria-label={`Eliminar situation type ${r.code}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
            {(() => {
              const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE);
              return totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
                  <div className="text-muted-foreground">
                    Pagina {currentPage} de {totalPages} ({rows.length}{" "}
                    tipos)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
