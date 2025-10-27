'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Edit2, Trash2, RefreshCw, ArrowUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface User {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  notes: string | null
  role_id: string | null
  created_at: string
  updated_at: string | null
  active: boolean | null
}

interface Role {
  id: string
  name: string
}

interface UsersListProps {
  users: User[]
  roles: Role[]
  onEdit: (user: User) => void
  onDelete: (userId: string) => void
  onRefresh: () => void
}

export default function UsersList({ users, roles, onEdit, onDelete, onRefresh }: UsersListProps) {
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sortBy, setSortBy] = useState<'first_name' | 'last_name' | 'role_id' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const roleNameById = useMemo(() => {
    return roles.reduce<Record<string, string>>((acc, role) => {
      acc[role.id] = role.name
      return acc
    }, {})
  }, [roles])

  const toggleSort = (column: 'first_name' | 'last_name' | 'role_id') => {
    if (sortBy === column) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortBy(null)
        setSortOrder('asc')
      }
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const sortedUsers = useMemo(() => {
    if (!sortBy) return users

    return [...users].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      if (sortBy === 'first_name') {
        aVal = (a.first_name || '').toLowerCase()
        bVal = (b.first_name || '').toLowerCase()
      } else if (sortBy === 'last_name') {
        aVal = (a.last_name || '').toLowerCase()
        bVal = (b.last_name || '').toLowerCase()
      } else if (sortBy === 'role_id') {
        aVal = (a.role_id && roleNameById[a.role_id] || '').toLowerCase()
        bVal = (b.role_id && roleNameById[b.role_id] || '').toLowerCase()
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [users, sortBy, sortOrder, roleNameById])

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  const handleConfirmDelete = async () => {
    if (deleteConfirmUser) {
      await onDelete(deleteConfirmUser.user_id)
      setDeleteConfirmUser(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const getSortIcon = (column: 'first_name' | 'last_name' | 'role_id') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />
    }
    return sortOrder === 'asc' ? (
      <span className="ml-1 inline">↑</span>
    ) : (
      <span className="ml-1 inline">↓</span>
    )
  }

  if (users.length === 0) {
    return (
      <div className="bg-card p-12 text-center">
        <p className="text-muted-foreground mb-4">Nenhum utilizador registado</p>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          RECARREGAR
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="bg-background w-full">
        <div className="w-full overflow-x-auto">
          <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
              <TableHeader className="sticky top-0 z-10 border-b text-center uppercase">
                <TableRow>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-accent transition-colors select-none"
                    onClick={() => toggleSort('first_name')}
                  >
                    NOME{getSortIcon('first_name')}
                  </TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-accent transition-colors select-none"
                    onClick={() => toggleSort('last_name')}
                  >
                    APELIDO{getSortIcon('last_name')}
                  </TableHead>
                  <TableHead className="text-center">EMAIL</TableHead>
                  <TableHead 
                    className="text-center cursor-pointer hover:bg-accent transition-colors select-none"
                    onClick={() => toggleSort('role_id')}
                  >
                    FUNÇÃO{getSortIcon('role_id')}
                  </TableHead>
                  <TableHead className="text-center">ESTADO</TableHead>
                  <TableHead className="text-center">DATA CRIAÇÃO</TableHead>
                  <TableHead className="text-center">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-accent transition-colors">
                    <TableCell>{user.first_name || '-'}</TableCell>
                    <TableCell>{user.last_name || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{(user.role_id && roleNameById[user.role_id]) || '-'}</TableCell>
                    <TableCell>{user.active === false ? 'Inativo' : 'Ativo'}</TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="default"
                          size="icon"
                          onClick={() => onEdit(user)}
                          title="Editar utilizador"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => setDeleteConfirmUser(user)}
                          title="Eliminar utilizador"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          RECARREGAR
        </Button>
      </div>

      <Dialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CONFIRMAR ELIMINAÇÃO</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja eliminar o utilizador{' '}
              <strong>
                {deleteConfirmUser ? `${deleteConfirmUser.first_name} ${deleteConfirmUser.last_name}`.trim() : ''}
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
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              ELIMINAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
