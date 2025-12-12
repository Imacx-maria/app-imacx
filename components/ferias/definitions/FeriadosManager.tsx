"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Feriado {
  id: string;
  holiday_date: string;
  description: string;
}

export default function FeriadosManager() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newDescription, setNewDescription] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchFeriados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("feriados")
        .select("id, holiday_date, description")
        .order("holiday_date", { ascending: true });

      if (fetchError) throw fetchError;
      setFeriados((data as Feriado[]) || []);
    } catch (err: any) {
      console.error("Error fetching feriados:", err);
      setError(err.message || "Erro ao carregar feriados");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchFeriados();
  }, [fetchFeriados]);

  const handleAdd = async () => {
    setError(null);
    if (!newDate) {
      setError("Selecione a data.");
      return;
    }
    if (!newDescription.trim()) {
      setError("A descriçao é obrigatoria.");
      return;
    }

    setSubmitting(true);
    try {
      const dateStr = newDate.toISOString().split("T")[0];
      const { error: insertError } = await supabase.from("feriados").insert({
        holiday_date: dateStr,
        description: newDescription.trim(),
      });

      if (insertError) throw insertError;

      setNewDate(undefined);
      setNewDescription("");
      await fetchFeriados();
    } catch (err: any) {
      console.error("Error creating feriado:", err);
      setError(err.message || "Erro ao criar feriado");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    if (!confirm("Eliminar este feriado?")) return;

    setSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from("feriados")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      await fetchFeriados();
    } catch (err: any) {
      console.error("Error deleting feriado:", err);
      setError(err.message || "Erro ao eliminar feriado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm">GESTAO DE FERIADOS</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFeriados}
            disabled={loading || submitting}
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-2">
            <Label>Data</Label>
            <DatePicker value={newDate} onChange={setNewDate} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descriçao</Label>
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Ex: NATAL"
              disabled={submitting}
            />
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

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            A carregar...
          </div>
        ) : feriados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem feriados.</p>
        ) : (
          <>
            <Table className="w-full imx-table-compact">
              <TableHeader>
                <TableRow>
                  <TableHead className="imx-border-b">Data</TableHead>
                  <TableHead className="imx-border-b">Descriçao</TableHead>
                  <TableHead className="text-right imx-border-b">Açao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const totalPages = Math.ceil(feriados.length / ITEMS_PER_PAGE);
                  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                  const paginatedFeriados = feriados.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                  
                  return paginatedFeriados.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap">
                    {f.holiday_date}
                  </TableCell>
                  <TableCell>{f.description}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(f.id)}
                      disabled={submitting}
                      aria-label={`Eliminar feriado ${f.holiday_date}`}
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
              const totalPages = Math.ceil(feriados.length / ITEMS_PER_PAGE);
              return totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
                  <div className="text-muted-foreground">
                    Pagina {currentPage} de {totalPages} ({feriados.length}{" "}
                    feriados)
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
