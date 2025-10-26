'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import CreateUserForm from '@/components/forms/CreateUserForm'
import UsersList from '@/components/UsersList'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type Role = {
  id: string
  name: string
}

export type ManagedUser = {
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

export default function UtilizadoresPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [roles, setRoles] = useState<Role[]>([])

  const supabase = useMemo(() => createBrowserClient(), [])

  const loadRoles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error
      setRoles(data || [])
    } catch (err) {
      console.error('Error loading roles:', err)
    }
  }, [supabase])

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `id, user_id, first_name, last_name, email, phone, notes, role_id, active, created_at, updated_at`,
        )
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers((data as ManagedUser[]) || [])
      setError(null)
    } catch (err) {
      console.error('Error loading users:', err)
      setError('Erro ao carregar utilizadores')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadUsers()
    loadRoles()
  }, [loadRoles, loadUsers])

  const handleCreateSuccess = () => {
    setIsDialogOpen(false)
    setEditingUser(null)
    loadUsers()
  }

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja eliminar este utilizador?')) return

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId)

      if (error) throw error
      
      await loadUsers()
    } catch (err) {
      console.error('Error deleting user:', err)
      setError('Erro ao eliminar utilizador')
    }
  }

  const handleEdit = (user: ManagedUser) => {
    setEditingUser(user)
    setIsDialogOpen(true)
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GESTÃO DE UTILIZADORES</h1>
          <p className="text-muted-foreground mt-2">Crie e gerencie utilizadores, perfis e funções</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="default"
              className="gap-2"
              onClick={() => setEditingUser(null)}
            >
              <Plus className="h-4 w-4" />
              NOVO UTILIZADOR
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'EDITAR UTILIZADOR' : 'CRIAR NOVO UTILIZADOR'}
              </DialogTitle>
            </DialogHeader>
            <CreateUserForm
              editingUser={editingUser}
              roles={roles}
              onSuccess={handleCreateSuccess}
              onCancel={() => {
                setIsDialogOpen(false)
                setEditingUser(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando utilizadores...</p>
        </div>
      ) : (
        <UsersList 
          users={users} 
          roles={roles}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRefresh={loadUsers}
        />
      )}
    </div>
  )
}
