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
  id: string
  user_id: string
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
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `id, user_id, first_name, last_name, email, phone, notes, role_id, departamento_id, active, created_at, updated_at`,
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading users:', error)
        throw error
      }

      // Fetch siglas for each user
      const usersWithSiglas = await Promise.all(
        (data || []).map(async (user: any) => {
          const { data: siglasData } = await supabase
            .from('user_siglas')
            .select('sigla')
            .eq('profile_id', user.id)

          return {
            ...user,
            siglas: siglasData?.map((s: any) => s.sigla) || []
          }
        })
      )

      console.log('Loaded users:', usersWithSiglas)
      setUsers(usersWithSiglas as ManagedUser[])
      setError(null)
    } catch (err: any) {
      console.error('Error loading users:', err)
      setError(`Erro ao carregar utilizadores: ${err.message || err}`)
    } finally {
      setLoading(false)
    }
  }, [supabase])

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

  return (
    <PagePermissionGuard pageId="definicoes/utilizadores">
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GESTÃO DE UTILIZADORES</h1>
          <p className="text-muted-foreground mt-2">Gerencie utilizadores, departamentos e siglas</p>
        </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">Utilizadores</TabsTrigger>
          <TabsTrigger value="departments">Departamentos</TabsTrigger>
          <TabsTrigger value="siglas">Siglas</TabsTrigger>
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
            />
          )}
        </TabsContent>

        {/* TAB 2: DEPARTMENTS */}
        <TabsContent value="departments" className="space-y-4">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Gestão de departamentos - Em desenvolvimento</p>
          </div>
        </TabsContent>

        {/* TAB 3: SIGLAS */}
        <TabsContent value="siglas" className="space-y-4">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Gestão de siglas - Em desenvolvimento</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </PagePermissionGuard>
  )
}
