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
import { Checkbox } from '@/components/ui/checkbox'

export interface DepartamentoOption {
  id: string
  nome: string
  codigo?: string | null
  is_vendas?: boolean | null
}

interface CreatableDepartamentoComboboxProps {
  value: string
  onChange: (value: string) => void
  departamentos?: DepartamentoOption[]
  onDepartamentoCreated?: () => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  showLabel?: boolean
}

export default function CreatableDepartamentoCombobox({
  value,
  onChange,
  departamentos: providedDepartamentos = [],
  onDepartamentoCreated,
  label = 'DEPARTAMENTO',
  placeholder = 'Selecione um departamento...',
  disabled = false,
  className = '',
  showLabel = true,
}: CreatableDepartamentoComboboxProps) {
  const [open, setOpen] = useState(false)
  const [departamentos, setDepartamentos] = useState<DepartamentoOption[]>(providedDepartamentos)
  const [loading, setLoading] = useState(providedDepartamentos.length === 0)
  const [searchValue, setSearchValue] = useState('')

  // Create new departamento dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newDepartamentoNome, setNewDepartamentoNome] = useState('')
  const [newDepartamentoCodigo, setNewDepartamentoCodigo] = useState('')
  const [newDepartamentoIsVendas, setNewDepartamentoIsVendas] = useState(false)
  const [creating, setCreating] = useState(false)

  const supabase = createBrowserClient()

  const fetchDepartamentos = async () => {
    if (providedDepartamentos.length > 0) {
      setDepartamentos(providedDepartamentos)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('departamentos')
        .select('id, nome, codigo, is_vendas')
        .eq('active', true)
        .order('nome', { ascending: true })

      if (error) {
        console.error('Error fetching departamentos:', error)
        return
      }

      setDepartamentos((data as DepartamentoOption[]) || [])
    } catch (error) {
      console.error('Error loading departamentos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartamentos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providedDepartamentos])

  const handleCreateDepartamento = async () => {
    if (!newDepartamentoNome.trim()) return

    try {
      setCreating(true)
      const { data, error } = await supabase
        .from('departamentos')
        .insert({
          nome: newDepartamentoNome.trim(),
          codigo: newDepartamentoCodigo.trim() || null,
          is_vendas: newDepartamentoIsVendas,
          active: true,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating departamento:', error)
        alert('Erro ao criar departamento: ' + error.message)
        return
      }

      // Add to local state
      const newDepartamento: DepartamentoOption = {
        id: data.id,
        nome: data.nome,
        codigo: data.codigo,
        is_vendas: data.is_vendas,
      }
      setDepartamentos([...departamentos, newDepartamento])

      // Select the newly created departamento
      onChange(data.id)

      // Close dialog and reset
      setCreateDialogOpen(false)
      setNewDepartamentoNome('')
      setNewDepartamentoCodigo('')
      setNewDepartamentoIsVendas(false)

      // Notify parent
      if (onDepartamentoCreated) onDepartamentoCreated()
    } catch (error) {
      console.error('Error creating departamento:', error)
      alert('Erro ao criar departamento')
    } finally {
      setCreating(false)
    }
  }

  const selectedDepartamento = departamentos.find((dept) => dept.id === value)

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
            {selectedDepartamento ? selectedDepartamento.nome : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Procurar departamento..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-2 text-center text-sm">
                  <p className="text-muted-foreground mb-2">Nenhum departamento encontrado</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCreateDialogOpen(true)
                      setNewDepartamentoNome(searchValue)
                      setOpen(false)
                    }}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Criar &quot;{searchValue}&quot;
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {departamentos.map((dept) => (
                  <CommandItem
                    key={dept.id}
                    value={dept.nome}
                    onSelect={() => {
                      onChange(dept.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === dept.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {dept.nome}
                    {dept.codigo && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({dept.codigo})
                      </span>
                    )}
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
                  Criar novo departamento
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Create Departamento Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>CRIAR NOVO DEPARTAMENTO</DialogTitle>
            <DialogDescription>
              Adicione um novo departamento ao sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dept-nome">Nome do Departamento *</Label>
              <Input
                id="dept-nome"
                value={newDepartamentoNome}
                onChange={(e) => setNewDepartamentoNome(e.target.value)}
                placeholder="Ex: Vendas, Produção, Logística"
                disabled={creating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-codigo">Código</Label>
              <Input
                id="dept-codigo"
                value={newDepartamentoCodigo}
                onChange={(e) => setNewDepartamentoCodigo(e.target.value)}
                placeholder="Ex: VEND, PROD, LOG"
                disabled={creating}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="dept-is-vendas"
                checked={newDepartamentoIsVendas}
                onCheckedChange={(checked) =>
                  setNewDepartamentoIsVendas(checked === true)
                }
                disabled={creating}
              />
              <Label
                htmlFor="dept-is-vendas"
                className="cursor-pointer font-normal"
              >
                É departamento de vendas
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false)
                setNewDepartamentoNome('')
                setNewDepartamentoCodigo('')
                setNewDepartamentoIsVendas(false)
              }}
              disabled={creating}
            >
              CANCELAR
            </Button>
            <Button
              onClick={handleCreateDepartamento}
              disabled={!newDepartamentoNome.trim() || creating}
            >
              {creating ? 'CRIANDO...' : 'CRIAR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
