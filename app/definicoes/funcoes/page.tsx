"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createBrowserClient } from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import { Plus, Save, Trash2 } from "lucide-react";
import { PagePermissionGuard } from "@/components/PagePermissionGuard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Role = {
  id: string;
  name: string;
  description: string | null;
  page_permissions: string[];
};

// Available pages in the system
// NOTE: When adding new pages to the app, always add them here too!
const AVAILABLE_PAGES = [
  {
    id: "*",
    name: "Todas as páginas (Admin)",
    description: "Acesso completo",
    category: null,
  },
  {
    id: "dashboard",
    name: "Painel de Controlo",
    description: "/dashboard",
    category: null,
  },
  {
    id: "designer-flow",
    name: "Fluxo de Design",
    description: "/designer-flow",
    category: null,
  },

  // Produção (parent and subpages)
  {
    id: "producao",
    name: "Produção (Todas)",
    description: "/producao/* (concede todos os subpáginas)",
    category: "producao",
  },
  {
    id: "producao/operacoes",
    name: "  → Operações",
    description: "/producao/operacoes",
    category: "producao",
  },
  {
    id: "producao/analytics",
    name: "  → Análises de Produção",
    description: "/producao/analytics",
    category: "producao",
  },

  // Stocks (parent and subpages)
  {
    id: "stocks",
    name: "Stocks (Todas)",
    description: "/stocks/* (concede todos os subpáginas)",
    category: "stocks",
  },
  {
    id: "stocks/gestao",
    name: "  → Gestão de Stocks",
    description: "/stocks/gestao",
    category: "stocks",
  },

  // Gestão (parent and subpages)
  {
    id: "gestao",
    name: "Gestão (Todas)",
    description: "/gestao/* (concede todos os subpáginas)",
    category: "gestao",
  },
  {
    id: "gestao/faturacao",
    name: "  → Faturação",
    description: "/gestao/faturacao",
    category: "gestao",
  },
  {
    id: "gestao/analise-financeira",
    name: "  → Análise Financeira",
    description: "/gestao/analise-financeira",
    category: "gestao",
  },

  // Férias (Vacation/Leave)
  {
    id: "ferias",
    name: "Férias (Todas)",
    description: "/ferias/* (gestão de férias e ausências)",
    category: "ferias",
  },

  // Quotes
  {
    id: "quotes",
    name: "Orçamentos (Todas)",
    description: "/quotes/* (concede todos os subpáginas)",
    category: "quotes",
  },
  {
    id: "quotes/search",
    name: "  → Pesquisa de Orçamentos",
    description: "/quotes/search",
    category: "quotes",
  },

  // Reports
  {
    id: "reports",
    name: "Relatórios (Todas)",
    description: "/reports/* (concede todos os subpáginas)",
    category: "reports",
  },
  {
    id: "reports/ai-executive-report",
    name: "  → Relatório Executivo IA",
    description: "/reports/ai-executive-report",
    category: "reports",
  },
  {
    id: "reports/top10-brindes",
    name: "  → Top 10 Brindes",
    description: "/reports/top10-brindes",
    category: "reports",
  },

  // Mobile
  {
    id: "mobile",
    name: "Mobile (Todas)",
    description: "/mobile/* (concede todos os subpáginas)",
    category: "mobile",
  },
  {
    id: "mobile/status",
    name: "  → Status Mobile",
    description: "/mobile/status",
    category: "mobile",
  },

  // Definições (parent and subpages)
  {
    id: "definicoes",
    name: "Definições (Todas)",
    description: "/definicoes/* (concede todos os subpáginas)",
    category: "definicoes",
  },
  {
    id: "definicoes/utilizadores",
    name: "  → Gestão de Utilizadores",
    description: "/definicoes/utilizadores",
    category: "definicoes",
  },
  {
    id: "definicoes/funcoes",
    name: "  → Gestão de Funções",
    description: "/definicoes/funcoes",
    category: "definicoes",
  },
  {
    id: "definicoes/feriados",
    name: "  → Gestão de Feriados",
    description: "/definicoes/feriados",
    category: "definicoes",
  },
  {
    id: "definicoes/maquinas",
    name: "  → Gestão de Máquinas",
    description: "/definicoes/maquinas",
    category: "definicoes",
  },
  {
    id: "definicoes/materiais",
    name: "  → Gestão de Materiais",
    description: "/definicoes/materiais",
    category: "definicoes",
  },
  {
    id: "definicoes/armazens",
    name: "  → Gestão de Armazéns",
    description: "/definicoes/armazens",
    category: "definicoes",
  },
  {
    id: "definicoes/complexidade",
    name: "  → Gestão de Complexidade",
    description: "/definicoes/complexidade",
    category: "definicoes",
  },
  {
    id: "definicoes/transportadoras",
    name: "  → Gestão de Transportadoras",
    description: "/definicoes/transportadoras",
    category: "definicoes",
  },
  {
    id: "definicoes/user-name-mapping",
    name: "  → Mapeamento de Utilizadores",
    description: "/definicoes/user-name-mapping",
    category: "definicoes",
  },
];

export default function FuncoesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const supabase = useMemo(() => createBrowserClient(), []);

  const loadRoles = useCallback(async () => {
    try {
      setLoadingRoles(true);
      const { data, error } = await supabase
        .from("roles")
        .select("id, name, description, page_permissions")
        .order("name", { ascending: true });

      if (error) throw error;
      setRoles((data as Role[]) || []);
    } catch (err) {
      console.error("Error loading roles:", err);
      setError("Erro ao carregar funções");
    } finally {
      setLoadingRoles(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handlePermissionToggle = (
    roleId: string,
    pageId: string,
    checked: boolean,
  ) => {
    setRoles((prevRoles) =>
      prevRoles.map((role) => {
        if (role.id !== roleId) return role;

        let newPermissions = [...(role.page_permissions || [])];

        // If toggling "*", clear all other permissions
        if (pageId === "*") {
          newPermissions = checked ? ["*"] : [];
        } else {
          // If adding other permission, remove "*"
          if (checked) {
            newPermissions = newPermissions.filter((p) => p !== "*");
            if (!newPermissions.includes(pageId)) {
              newPermissions.push(pageId);
            }
          } else {
            newPermissions = newPermissions.filter((p) => p !== pageId);
          }
        }

        return { ...role, page_permissions: newPermissions };
      }),
    );
  };

  const handleSavePermissions = async (roleId: string) => {
    try {
      setSaving(roleId);
      const role = roles.find((r) => r.id === roleId);
      if (!role) return;

      // Normalize all permissions to lowercase for consistency
      const normalizedPermissions = role.page_permissions.map((p) =>
        p.toLowerCase(),
      );

      const { error } = await supabase
        .from("roles")
        .update({ page_permissions: normalizedPermissions })
        .eq("id", roleId);

      if (error) throw error;

      // Success feedback
      setTimeout(() => setSaving(null), 1000);
    } catch (err) {
      console.error("Error saving permissions:", err);
      setError("Erro ao guardar permissões");
      setSaving(null);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;

    try {
      setCreating(true);
      const { data, error } = await supabase
        .from("roles")
        .insert({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || null,
          page_permissions: ["dashboard"], // Default permission
        })
        .select()
        .single();

      if (error) throw error;

      // Add to list
      setRoles([...roles, data as Role]);

      // Close dialog and reset
      setIsCreateRoleDialogOpen(false);
      setNewRoleName("");
      setNewRoleDescription("");
    } catch (err: any) {
      console.error("Error creating role:", err);
      alert("Erro ao criar função: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (
      !window.confirm(`Tem certeza que deseja eliminar a função "${roleName}"?`)
    )
      return;

    try {
      const { error } = await supabase.from("roles").delete().eq("id", roleId);

      if (error) throw error;

      setRoles(roles.filter((r) => r.id !== roleId));
    } catch (err: any) {
      console.error("Error deleting role:", err);
      alert("Erro ao eliminar função: " + err.message);
    }
  };

  const hasPermission = (role: Role, pageId: string) => {
    if (!role.page_permissions) return false;
    if (role.page_permissions.includes("*")) return true;
    return role.page_permissions.includes(pageId);
  };

  return (
    <PagePermissionGuard pageId="definicoes/funcoes">
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            GESTÃO DE FUNÇÕES E PERMISSÕES
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure quais funções têm acesso a cada página do sistema
          </p>
        </div>

        <div className="flex items-center justify-end">
          <Dialog
            open={isCreateRoleDialogOpen}
            onOpenChange={setIsCreateRoleDialogOpen}
          >
            <DialogTrigger asChild>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="default" size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Criar nova função</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>CRIAR NOVA FUNÇÃO</DialogTitle>
                <DialogDescription>
                  Adicione uma nova função ao sistema
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="create-role-name">Nome da Função *</Label>
                  <Input
                    id="create-role-name"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Ex: Operador de Máquina"
                    disabled={creating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-role-description">Descrição</Label>
                  <Textarea
                    id="create-role-description"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Descrição opcional da função"
                    rows={3}
                    disabled={creating}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateRoleDialogOpen(false);
                    setNewRoleName("");
                    setNewRoleDescription("");
                  }}
                  disabled={creating}
                >
                  CANCELAR
                </Button>
                <Button
                  onClick={handleCreateRole}
                  disabled={!newRoleName.trim() || creating}
                >
                  {creating ? "CRIANDO..." : "CRIAR"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {loadingRoles ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando funções...</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{role.name}</CardTitle>
                      {role.description && (
                        <CardDescription className="mt-1">
                          {role.description}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRole(role.id, role.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      Páginas Acessíveis:
                    </Label>
                    {AVAILABLE_PAGES.map((page) => (
                      <div key={page.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={`${role.id}-${page.id}`}
                          checked={hasPermission(role, page.id)}
                          onCheckedChange={(checked) =>
                            handlePermissionToggle(
                              role.id,
                              page.id,
                              checked as boolean,
                            )
                          }
                          disabled={page.id !== "*" && hasPermission(role, "*")}
                        />
                        <div className="flex-1">
                          <label
                            htmlFor={`${role.id}-${page.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {page.name}
                          </label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {page.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={() => handleSavePermissions(role.id)}
                    disabled={saving === role.id}
                  >
                    <Save className="h-4 w-4" />
                    {saving === role.id ? "GUARDANDO..." : "GUARDAR"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PagePermissionGuard>
  );
}
