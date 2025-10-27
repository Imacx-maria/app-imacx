'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export interface RoleOption {
  id: string
  name: string
}

interface CreatableRoleComboboxProps {
  value: string
  onChange: (value: string) => void
  roles?: RoleOption[]
  onRoleCreated?: () => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  showLabel?: boolean
}

export default function CreatableRoleCombobox({
  value,
  onChange,
  roles: providedRoles = [],
  onRoleCreated,
  label = 'Função',
  placeholder = 'Selecione uma função...',
  disabled = false,
  className = '',
  showLabel = true,
}: CreatableRoleComboboxProps) {
  const [open, setOpen] = useState(false)
  const [roles, setRoles] = useState<RoleOption[]>(providedRoles)
  const [loading, setLoading] = useState(providedRoles.length === 0)
  const [searchValue, setSearchValue] = useState('')
  
  // Create new role dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [creating, setCreating] = useState(false)

  const supabase = createBrowserClient()

  const fetchRoles = async () => {
    if (providedRoles.length > 0) {
      setRoles(providedRoles)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('roles')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching roles:', error)
        return
      }

      setRoles((data as RoleOption[]) || [])
    } catch (error) {
      console.error('Error loading roles:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [providedRoles])

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return

    try {
      setCreating(true)
      const { data, error } = await supabase
        .from('roles')
        .insert({
          name: newRoleName.trim(),
          description: newRoleDescription.trim() || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating role:', error)
        alert('Erro ao criar função: ' + error.message)
        return
      }

      // Add to local state
      const newRole = { id: data.id, name: data.name }
      setRoles([...roles, newRole])
      
      // Select the newly created role
      onChange(data.id)
      
      // Close dialog and reset
      setCreateDialogOpen(false)
      setNewRoleName('')
      setNewRoleDescription('')
      
      // Notify parent
      if (onRoleCreated) onRoleCreated()
    } catch (error) {
      console.error('Error creating role:', error)
      alert('Erro ao criar função')
    } finally {
      setCreating(false)
    }
  }

  const selectedRole = roles.find((role) => role.id === value)

  return (
    <div className={className}>
      {showLabel && label && <Label className="mb-2 block">{label}</Label>}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className="w-full justify-between"
          >
            {selectedRole ? selectedRole.name : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput 
              placeholder="Procurar função..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 text-center text-sm">
                  <p className="text-muted-foreground mb-2">Nenhuma função encontrada</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCreateDialogOpen(true)
                      setNewRoleName(searchValue)
                      setOpen(false)
                    }}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Criar "{searchValue}"
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {roles.map((role) => (
                  <CommandItem
                    key={role.id}
                    value={role.name}
                    onSelect={() => {
                      onChange(role.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === role.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {role.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setCreateDialogOpen(true)
                    setOpen(false)
                  }}
                  className="justify-center text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar nova função
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Role Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CRIAR NOVA FUNÇÃO</DialogTitle>
            <DialogDescription>
              Adicione uma nova função ao sistema
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Nome da Função *</Label>
              <Input
                id="role-name"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ex: Operador de Máquina"
                disabled={creating}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role-description">Descrição</Label>
              <Textarea
                id="role-description"
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
                setCreateDialogOpen(false)
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
  )
}
