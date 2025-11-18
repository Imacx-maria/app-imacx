"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Edit2,
  Trash2,
  RefreshCw,
  ArrowUpDown,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { EditButton, DeleteButton } from "@/components/custom/ActionButtons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManagedUser } from "@/app/definicoes/utilizadores/page";

// Use ManagedUser as User for consistency with the page
type User = ManagedUser;

interface Role {
  id: string;
  name: string;
}

interface Departamento {
  id: string;
  nome: string;
}

interface UsersListProps {
  users: User[];
  roles: Role[];
  departamentos: Departamento[];
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onRefresh: () => void;
  onRepair?: (user: User) => void;
}

export default function UsersList({
  users,
  roles,
  departamentos,
  onEdit,
  onDelete,
  onRefresh,
  onRepair,
}: UsersListProps) {
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<
    "first_name" | "last_name" | "role_id" | null
  >(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const roleNameById = useMemo(() => {
    return roles.reduce<Record<string, string>>((acc, role) => {
      acc[role.id] = role.name;
      return acc;
    }, {});
  }, [roles]);

  const departamentoNameById = useMemo(() => {
    return departamentos.reduce<Record<string, string>>((acc, dept) => {
      acc[dept.id] = dept.nome;
      return acc;
    }, {});
  }, [departamentos]);

  const toggleSort = (column: "first_name" | "last_name" | "role_id") => {
    if (sortBy === column) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortBy(null);
        setSortOrder("asc");
      }
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const sortedUsers = useMemo(() => {
    if (!sortBy) return users;

    return [...users].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      if (sortBy === "first_name") {
        aVal = (a.first_name || "").toLowerCase();
        bVal = (b.first_name || "").toLowerCase();
      } else if (sortBy === "last_name") {
        aVal = (a.last_name || "").toLowerCase();
        bVal = (b.last_name || "").toLowerCase();
      } else if (sortBy === "role_id") {
        aVal = ((a.role_id && roleNameById[a.role_id]) || "").toLowerCase();
        bVal = ((b.role_id && roleNameById[b.role_id]) || "").toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [users, sortBy, sortOrder, roleNameById]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmUser) {
      await onDelete(deleteConfirmUser.user_id);
      setDeleteConfirmUser(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-PT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getSortIcon = (column: "first_name" | "last_name" | "role_id") => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />;
    }
    return sortOrder === "asc" ? (
      <span className="ml-1 inline">↑</span>
    ) : (
      <span className="ml-1 inline">↓</span>
    );
  };

  if (users.length === 0) {
    return (
      <div className="bg-card p-12 text-center">
        <p className="text-muted-foreground mb-4">
          Nenhum utilizador registado
        </p>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
          />
          RECARREGAR
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-background w-full">
        <div className="w-full overflow-x-auto">
          <Table className="w-full imx-table-compact">
            <TableHeader className="sticky top-0 z-10 imx-border-b text-center uppercase">
              <TableRow>
                <TableHead
                  className="text-center cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => toggleSort("first_name")}
                >
                  NOME{getSortIcon("first_name")}
                </TableHead>
                <TableHead
                  className="text-center cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => toggleSort("last_name")}
                >
                  APELIDO{getSortIcon("last_name")}
                </TableHead>
                <TableHead className="text-center">EMAIL</TableHead>
                <TableHead
                  className="text-center cursor-pointer hover:bg-accent transition-colors select-none"
                  onClick={() => toggleSort("role_id")}
                >
                  FUNÇÃO{getSortIcon("role_id")}
                </TableHead>
                <TableHead className="text-center">DEPARTAMENTO</TableHead>
                <TableHead className="text-center">SIGLAS</TableHead>
                <TableHead className="text-center">ESTADO</TableHead>
                <TableHead className="text-center">DATA CRIAÇÃO</TableHead>
                <TableHead className="text-center">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((user) => (
                <TableRow
                  key={user.id || user.auth_user_id}
                  className="imx-row-hover"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {user.has_profile === false && (
                        <AlertTriangle
                          className="h-4 w-4 text-warning"
                          aria-label="Perfil não criado"
                        />
                      )}
                      {user.first_name || "-"}
                    </div>
                  </TableCell>
                  <TableCell>{user.last_name || "-"}</TableCell>
                  <TableCell>{user.email || "-"}</TableCell>
                  <TableCell>
                    {user.has_profile === false ? (
                      <span className="text-warning font-semibold">
                        ⚠️ PRECISA CONFIGURAÇÃO
                      </span>
                    ) : (
                      (user.role_id && roleNameById[user.role_id]) || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {(user.departamento_id &&
                      departamentoNameById[user.departamento_id]) ||
                      "-"}
                  </TableCell>
                  <TableCell>
                    {user.siglas && user.siglas.length > 0 ? (
                      <div className="flex flex-wrap gap-1 justify-center">
                        {user.siglas.map((sigla) => (
                          <span
                            key={sigla}
                            className="inline-block px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono font-semibold"
                          >
                            {sigla}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {user.active === false ? "Inativo" : "Ativo"}
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      {user.has_profile === false ? (
                        <>
                          {onRepair && (
                            <Button
                              variant="default"
                              size="icon"
                              onClick={() => onRepair(user)}
                              title="Criar perfil"
                            >
                              <Wrench className="h-4 w-4" />
                            </Button>
                          )}
                          <DeleteButton
                            onClick={() => setDeleteConfirmUser(user)}
                            title="Eliminar utilizador"
                          />
                        </>
                      ) : (
                        <>
                          <EditButton
                            onClick={() => onEdit(user)}
                            title="Editar utilizador"
                          />
                          <DeleteButton
                            onClick={() => setDeleteConfirmUser(user)}
                            title="Eliminar utilizador"
                          />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          RECARREGAR
        </Button>
      </div>

      <Dialog
        open={!!deleteConfirmUser}
        onOpenChange={(open) => !open && setDeleteConfirmUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CONFIRMAR ELIMINAÇÃO</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja eliminar o utilizador{" "}
              <strong>
                {deleteConfirmUser
                  ? `${deleteConfirmUser.first_name} ${deleteConfirmUser.last_name}`.trim()
                  : ""}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmUser(null)}
            >
              CANCELAR
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              ELIMINAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
