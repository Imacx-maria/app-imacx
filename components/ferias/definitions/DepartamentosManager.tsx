"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Check, Edit, Loader2, Plus, RotateCw, Trash2, X, ArrowLeft, ArrowRight } from "lucide-react";

const ITEMS_PER_PAGE = 40;

interface Departamento {
  id: number;
  nome: string;
}

const DEFAULT_DEPARTAMENTO_NOME = "IMACX";

export default function DepartamentosManager() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newNome, setNewNome] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const defaultDepartamento = useMemo(() => {
    return departamentos.find(
      (d) => d.nome.trim().toUpperCase() === DEFAULT_DEPARTAMENTO_NOME,
    );
  }, [departamentos]);

  const fetchDepartamentos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("departamentos")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (fetchError) throw fetchError;
      setDepartamentos((data as Departamento[]) || []);
    } catch (err: any) {
      console.error("Error fetching departamentos:", err);
      setError(err.message || "Erro ao carregar departamentos");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDepartamentos();
  }, [fetchDepartamentos]);

  const handleAdd = async () => {
    setError(null);
    const nome = newNome.trim();
    if (!nome) {
      setError("O nome é obrigatorio.");
      return;
    }
    if (nome.toUpperCase() === DEFAULT_DEPARTAMENTO_NOME) {
      setError(
        `${DEFAULT_DEPARTAMENTO_NOME} é reservado como departamento default.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from("departamentos")
        .insert({ nome });

      if (insertError) throw insertError;
      setNewNome("");
      await fetchDepartamentos();
    } catch (err: any) {
      console.error("Error creating departamento:", err);
      setError(err.message || "Erro ao criar departamento");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (dept: Departamento) => {
    if (dept.nome.trim().toUpperCase() === DEFAULT_DEPARTAMENTO_NOME) {
      setError(
        `${DEFAULT_DEPARTAMENTO_NOME} é o departamento default e nao pode ser alterado.`,
      );
      return;
    }
    setEditingId(dept.id);
    setEditNome(dept.nome);
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    setError(null);
    if (defaultDepartamento && editingId === defaultDepartamento.id) {
      setError(
        `${DEFAULT_DEPARTAMENTO_NOME} é o departamento default e nao pode ser alterado.`,
      );
      return;
    }
    const nome = editNome.trim();
    if (!nome) {
      setError("O nome é obrigatorio.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from("departamentos")
        .update({ nome })
        .eq("id", editingId);

      if (updateError) throw updateError;
      setEditingId(null);
      setEditNome("");
      await fetchDepartamentos();
    } catch (err: any) {
      console.error("Error updating departamento:", err);
      setError(err.message || "Erro ao atualizar departamento");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (dept: Departamento) => {
    setError(null);

    if (dept.nome.trim().toUpperCase() === DEFAULT_DEPARTAMENTO_NOME) {
      setError(
        `${DEFAULT_DEPARTAMENTO_NOME} é o departamento default e nao pode ser eliminado.`,
      );
      return;
    }

    if (!defaultDepartamento) {
      setError(
        `Nao foi possivel encontrar o departamento ${DEFAULT_DEPARTAMENTO_NOME}.`,
      );
      return;
    }

    if (
      !confirm(
        `Eliminar departamento ${dept.nome}? Colaboradores serao movidos para ${DEFAULT_DEPARTAMENTO_NOME}.`,
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const { error: reassignError } = await supabase
        .from("rh_employees")
        .update({ departamento_id: defaultDepartamento.id })
        .eq("departamento_id", dept.id);

      if (reassignError) throw reassignError;

      const { error: deleteError } = await supabase
        .from("departamentos")
        .delete()
        .eq("id", dept.id);

      if (deleteError) throw deleteError;
      await fetchDepartamentos();
    } catch (err: any) {
      console.error("Error deleting departamento:", err);
      setError(err.message || "Erro ao eliminar departamento");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm">GESTAO DE DEPARTAMENTOS</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDepartamentos}
            disabled={loading || submitting}
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-2 md:col-span-2">
            <Label>Novo Departamento</Label>
            <Input
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              placeholder="EX: DIGITAL"
              disabled={submitting}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />A guardar...
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

        <p className="text-xs text-muted-foreground">
          Tabela: <span className="font-mono">departamentos</span> (coluna{" "}
          <span className="font-mono">nome</span>). O default é{" "}
          {DEFAULT_DEPARTAMENTO_NOME}.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />A carregar...
          </div>
        ) : departamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registos.</p>
        ) : (
          <>
            <Table className="w-full imx-table-compact">
              <TableHeader>
                <TableRow>
                  <TableHead className="imx-border-b">ID</TableHead>
                  <TableHead className="imx-border-b">Nome</TableHead>
                  <TableHead className="text-right imx-border-b">Açao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const totalPages = Math.ceil(departamentos.length / ITEMS_PER_PAGE);
                  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                  const paginatedDepartamentos = departamentos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                  
                  return paginatedDepartamentos.map((dept) => {
                const isDefault =
                  dept.nome.trim().toUpperCase() === DEFAULT_DEPARTAMENTO_NOME;
                const isEditing = editingId === dept.id;
                return (
                  <TableRow key={dept.id}>
                    <TableCell className="whitespace-nowrap">
                      {dept.id}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <Input
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            disabled={submitting}
                          />
                        ) : (
                          <span>{dept.nome}</span>
                        )}
                        {isDefault && (
                          <Badge variant="secondary">DEFAULT</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              variant="default"
                              size="icon"
                              onClick={handleSaveEdit}
                              disabled={submitting}
                              aria-label={`Guardar ${dept.nome}`}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setEditingId(null);
                                setEditNome("");
                              }}
                              disabled={submitting}
                              aria-label={`Cancelar edicao ${dept.nome}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="default"
                              size="icon"
                              onClick={() => handleStartEdit(dept)}
                              disabled={submitting || isDefault}
                              aria-label={`Editar ${dept.nome}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDelete(dept)}
                              disabled={submitting || isDefault}
                              aria-label={`Eliminar ${dept.nome}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                });
                })()}
              </TableBody>
            </Table>
            {(() => {
              const totalPages = Math.ceil(departamentos.length / ITEMS_PER_PAGE);
              return totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 text-sm imx-border-t">
                  <div className="text-muted-foreground">
                    Pagina {currentPage} de {totalPages} ({departamentos.length}{" "}
                    departamentos)
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
