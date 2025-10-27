'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Plus, Save, Trash2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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

// Available pages in the system
const AVAILABLE_PAGES = [
  { id: '*', name: 'Todas as páginas (Admin)', description: 'Acesso completo' },
  { id: 'dashboard', name: 'Painel de Controlo', description: '/dashboard' },
  { id: 'designer-flow', name: 'Fluxo de Design', description: '/designer-flow' },
  { id: 'producao', name: 'Produção', description: '/producao/*' },
  { id: 'stocks', name: 'Stocks', description: '/stocks' },
  { id: 'gestao', name: 'Gestão', description: '/gestao/*' },
  { id: 'definicoes', name: 'Definições', description: '/definicoes/*' },
]

export default function FuncoesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  
  // Create role form
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const supabase = useMemo(() => createBrowserClient(), [])

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, description, page_permissions')
        .order('name', { ascending: true })

      if (error) throw error
      setRoles((data as Role[]) || [])
      setError(null)
    } catch (err) {
      console.error('Error loading roles:', err)
      setError('Erro ao carregar funções')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  const handlePermissionToggle = (roleId: string, pageId: string, checked: boolean) => {
    setRoles((prevRoles) =>
      prevRoles.map((role) => {
        if (role.id !== roleId) return role

        let newPermissions = [...(role.page_permissions || [])]

        // If toggling "*", clear all other permissions
        if (pageId === '*') {
          newPermissions = checked ? ['*'] : []
        } else {
          // If adding other permission, remove "*"
          if (checked) {
            newPermissions = newPermissions.filter((p) => p !== '*')
            if (!newPermissions.includes(pageId)) {
              newPermissions.push(pageId)
            }
          } else {
            newPermissions = newPermissions.filter((p) => p !== pageId)
          }
        }

        return { ...role, page_permissions: newPermissions }
      })
    )
  }

  const handleSavePermissions = async (roleId: string) => {
    try {
      setSaving(roleId)
      const role = roles.find((r) => r.id === roleId)
      if (!role) return

      const { error } = await supabase
        .from('roles')
        .update({ page_permissions: role.page_permissions })
        .eq('id', roleId)

      if (error) throw error
      
      // Success feedback (could add a toast here)
      setTimeout(() => setSaving(null), 1000)
    } catch (err) {
      console.error('Error saving permissions:', err)
      setError('Erro ao guardar permissões')
      setSaving(null)
    }
  }

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return

    try {
      setCreating(true)
      const { data, error } = await supabase
        .from('roles')
        .insert({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || null,
          page_permissions: ['dashboard'], // Default permission
        })
        .select()
        .single()

      if (error) throw error

      // Add to list
      setRoles([...roles, data as Role])
      
      // Close dialog and reset
      setIsCreateDialogOpen(false)
      setNewRoleName('')
      setNewRoleDescription('')
    } catch (err: any) {
      console.error('Error creating role:', err)
      alert('Erro ao criar função: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!window.confirm(`Tem certeza que deseja eliminar a função "${roleName}"?`)) return

    try {
      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId)

      if (error) throw error
      
      setRoles(roles.filter((r) => r.id !== roleId))
    } catch (err: any) {
      console.error('Error deleting role:', err)
      alert('Erro ao eliminar função: ' + err.message)
    }
  }

  const hasPermission = (role: Role, pageId: string) => {
    if (!role.page_permissions) return false
    if (role.page_permissions.includes('*')) return true
    return role.page_permissions.includes(pageId)
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">GESTÃO DE FUNÇÕES E PERMISSÕES</h1>
          <p className="text-muted-foreground mt-2">Configure que páginas cada função pode aceder</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
                  setIsCreateDialogOpen(false)
                  setNewRoleName('')
                  setNewRoleDescription('')
                }}
                disabled={creating}
              >
                CANCELAR
              </Button>
              <Button
                onClick={handleCreateRole}
                disabled={!newRoleName.trim() || creating}
              >
                {creating ? 'CRIANDO...' : 'CRIAR'}
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

      {loading ? (
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
                  <Label className="text-sm font-semibold">Páginas Acessíveis:</Label>
                  {AVAILABLE_PAGES.map((page) => (
                    <div key={page.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`${role.id}-${page.id}`}
                        checked={hasPermission(role, page.id)}
                        onCheckedChange={(checked) =>
                          handlePermissionToggle(role.id, page.id, checked as boolean)
                        }
                        disabled={
                          page.id !== '*' && hasPermission(role, '*')
                        }
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
                  {saving === role.id ? 'GUARDANDO...' : 'GUARDAR'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
