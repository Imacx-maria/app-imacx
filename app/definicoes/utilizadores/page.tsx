'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import CreateUserForm from '@/components/forms/CreateUserForm'
import UsersList from '@/components/UsersList'
import { PagePermissionGuard } from '@/components/PagePermissionGuard'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Role = {
  id: string
  name: string
  description: string | null
  page_permissions: string[]
}

type Departamento = {
  id: string
  nome: string
}

export type ManagedUser = {
  id: string | null // Can be null for orphaned users
  user_id: string
  auth_user_id: string // Auth user ID for repair operations
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  notes: string | null
  role_id: string | null
  departamento_id: string | null
  siglas?: string[]
  created_at: string
  updated_at: string | null
  active: boolean | null
  has_profile?: boolean // Flag to indicate if profile exists
}

export default function UtilizadoresPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)

  const supabase = useMemo(() => createBrowserClient(), [])

  const loadRoles = useCallback(async () => {
    try {
      setLoadingRoles(true)
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description, page_permissions')
        .order('name', { ascending: true })

      if (error) throw error
      setRoles((data as Role[]) || [])
    } catch (err) {
      console.error('Error loading roles:', err)
    } finally {
      setLoadingRoles(false)
    }
  }, [supabase])

  const loadDepartamentos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('departamentos')
        .select('id, nome')
        .order('nome', { ascending: true })

      if (error) throw error
      setDepartamentos(data || [])
    } catch (err) {
      console.error('Error loading departamentos:', err)
    }
  }, [supabase])

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      console.log('📋 [UTILIZADORES PAGE] Fetching users from API...')

      // Fetch users from server-side API route (with admin auth)
      const response = await fetch('/api/users/list')

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ [UTILIZADORES PAGE] API error:', errorData)
        throw new Error(errorData.error || 'Failed to load users')
      }

      const data = await response.json()
      console.log('✅ [UTILIZADORES PAGE] Received users:', data.count)

      // Sort by created_at desc
      const sortedUsers = (data.users || []).sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA
      })

      console.log('✅ [UTILIZADORES PAGE] Users sorted and ready')
      setUsers(sortedUsers as ManagedUser[])
      setError(null)
    } catch (err: any) {
      console.error('💥 [UTILIZADORES PAGE] Error loading users:', err)
      setError(`Erro ao carregar utilizadores: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
    loadRoles()
    loadDepartamentos()
  }, [loadRoles, loadUsers, loadDepartamentos])

  const handleCreateSuccess = () => {
    setIsSheetOpen(false)
    setEditingUser(null)
    loadUsers()
  }

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja eliminar este utilizador?')) return

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao eliminar utilizador')
      }

      await loadUsers()
    } catch (err: any) {
      console.error('Error deleting user:', err)
      setError(err.message || 'Erro ao eliminar utilizador')
    }
  }

  const handleEdit = (user: ManagedUser) => {
    setEditingUser(user)
    setIsSheetOpen(true)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadUsers()
    setRefreshing(false)
  }

  const [repairUser, setRepairUser] = useState<ManagedUser | null>(null)
  const [selectedRoleForRepair, setSelectedRoleForRepair] = useState<string>('')
  const [repairing, setRepairing] = useState(false)

  const handleRepair = (user: ManagedUser) => {
    setRepairUser(user)
    setSelectedRoleForRepair('')
  }

  const executeRepair = async () => {
    if (!repairUser || !selectedRoleForRepair) {
      alert('Por favor selecione uma função')
      return
    }

    try {
      setRepairing(true)

      const response = await fetch('/api/users/repair-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: repairUser.auth_user_id,
          email: repairUser.email,
          first_name: repairUser.first_name,
          last_name: repairUser.last_name,
          role_id: selectedRoleForRepair,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar perfil')
      }

      alert(`Perfil criado com sucesso! Função: ${result.role}`)
      setRepairUser(null)
      await loadUsers()
    } catch (err: any) {
      console.error('Error repairing profile:', err)
      alert(`Erro ao criar perfil: ${err.message}`)
    } finally {
      setRepairing(false)
    }
  }

  return (
    <PagePermissionGuard pageId="definicoes/utilizadores">
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GESTÃO DE UTILIZADORES</h1>
          <p className="text-muted-foreground mt-2">Gerencie utilizadores, departamentos e siglas</p>
        </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-1">
          <TabsTrigger value="users">Utilizadores</TabsTrigger>
        </TabsList>

        {/* TAB 1: USERS */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Recarregar utilizadores"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => setEditingUser(null)}
                  title="Adicionar utilizador"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>
                    {editingUser ? 'EDITAR UTILIZADOR' : 'CRIAR NOVO UTILIZADOR'}
                  </SheetTitle>
                  <SheetDescription>
                    {editingUser ? 'Atualize as informações do utilizador' : 'Preencha os dados para criar um novo utilizador'}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <CreateUserForm
                    key={editingUser?.user_id || 'new'}
                    editingUser={editingUser}
                    roles={roles}
                    onSuccess={handleCreateSuccess}
                    onCancel={() => {
                      setIsSheetOpen(false)
                      setEditingUser(null)
                    }}
                  />
                </div>
              </SheetContent>
            </Sheet>
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
              departamentos={departamentos}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRefresh={loadUsers}
              onRepair={handleRepair}
            />
          )}
        </TabsContent>


      </Tabs>

      {/* Repair Profile Dialog */}
      <Dialog open={!!repairUser} onOpenChange={(open) => !open && setRepairUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CRIAR PERFIL PARA UTILIZADOR</DialogTitle>
            <DialogDescription>
              Este utilizador existe no sistema de autenticação mas não tem um perfil completo.
              Selecione uma função para criar o perfil.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <p className="text-sm font-semibold">{repairUser?.email}</p>
            </div>
            <div>
              <Label>Nome</Label>
              <p className="text-sm font-semibold">{repairUser?.first_name} {repairUser?.last_name}</p>
            </div>
            <div>
              <Label htmlFor="repair-role">Função *</Label>
              <select
                id="repair-role"
                value={selectedRoleForRepair}
                onChange={(e) => setSelectedRoleForRepair(e.target.value)}
                className="w-full px-3 py-2 imx-border rounded-md"
              >
                <option value="">Selecione uma função...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepairUser(null)} disabled={repairing}>
              Cancelar
            </Button>
            <Button onClick={executeRepair} disabled={repairing || !selectedRoleForRepair}>
              {repairing ? 'A criar perfil...' : 'Criar Perfil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PagePermissionGuard>
  )
}
