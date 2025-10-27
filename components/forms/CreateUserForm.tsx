'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import CreatableRoleCombobox from '@/components/forms/CreatableRoleCombobox'

interface EditingUser {
  user_id: string
  first_name: string
  last_name: string
  email: string | null
  role_id: string | null
  phone: string | null
  notes: string | null
}

interface RoleOption {
  id: string
  name: string
}

interface CreateUserFormProps {
  editingUser?: EditingUser | null
  roles?: RoleOption[]
  onSuccess: () => void
  onCancel: () => void
}

export default function CreateUserForm({ editingUser, roles: providedRoles = [], onSuccess, onCancel }: CreateUserFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role_id: '',
    phone: '',
    notes: '',
  })
  const [roles, setRoles] = useState<RoleOption[]>(providedRoles)
  const [loading, setLoading] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(providedRoles.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')

  const supabase = useMemo(() => createBrowserClient(), [])

  const loadRoles = useCallback(async () => {
    if (providedRoles.length > 0) {
      setRoles(providedRoles)
      setLoadingRoles(false)
      return
    }

    try {
      setLoadingRoles(true)
      const { data, error } = await supabase
        .from('roles')
        .select('id, name')
        .order('name', { ascending: true })

      if (error) throw error
      setRoles((data as RoleOption[]) || [])
    } catch (err) {
      console.error('Error loading roles:', err)
      setError('Erro ao carregar funções')
    } finally {
      setLoadingRoles(false)
    }
  }, [providedRoles, supabase])

  useEffect(() => {
    loadRoles()
    setPassword('')
    if (editingUser) {
      setFormData({
        email: editingUser.email || '',
        first_name: editingUser.first_name || '',
        last_name: editingUser.last_name || '',
        role_id: editingUser.role_id || '',
        phone: editingUser.phone || '',
        notes: editingUser.notes || '',
      })
    } else {
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        role_id: '',
        phone: '',
        notes: '',
      })
    }
  }, [editingUser, loadRoles])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.email || !formData.first_name || !formData.last_name || !formData.role_id) {
        throw new Error('Preencha todos os campos obrigatórios')
      }

      if (editingUser) {
        // Update existing user via API
        const response = await fetch(`/api/users/${editingUser.user_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: password || undefined,
            first_name: formData.first_name,
            last_name: formData.last_name,
            role_id: formData.role_id,
            phone: formData.phone,
            notes: formData.notes,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao atualizar utilizador')
        }
      } else {
        // Create new user via API
        if (!password) {
          throw new Error('Defina uma palavra-passe para o novo utilizador')
        }

        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: password,
            first_name: formData.first_name,
            last_name: formData.last_name,
            role_id: formData.role_id,
            phone: formData.phone,
            notes: formData.notes,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar utilizador')
        }
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error submitting form:', err)
      setError(err.message || 'Erro ao processar formulário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>EMAIL *</Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="utilizador@example.com"
          disabled={!!editingUser}
        />
      </div>

      <div className="space-y-2">
        <Label>NOME COMPLETO *</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            type="text"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            placeholder="Primeiro nome"
          />
          <Input
            type="text"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            placeholder="Apelido"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>PALAVRA-PASSE {!editingUser && '*'}</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={editingUser ? "Deixe em branco para manter a atual" : "Mínimo 6 caracteres"}
        />
        {editingUser && (
          <p className="text-xs text-muted-foreground">
            Preencha apenas se desejar alterar a palavra-passe
          </p>
        )}
      </div>

      <CreatableRoleCombobox
        value={formData.role_id}
        onChange={(value) => setFormData({ ...formData, role_id: value })}
        roles={roles}
        onRoleCreated={loadRoles}
        label="FUNÇÃO *"
        placeholder="Selecione uma função"
        disabled={loadingRoles}
      />

      <div className="space-y-2">
        <Label>NOTAS</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Notas adicionais sobre este utilizador"
          rows={3}
        />
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={loading || loadingRoles}
          className="flex-1"
        >
          {loading ? 'PROCESSANDO...' : 'GUARDAR'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          CANCELAR
        </Button>
      </div>
    </form>
  )
}
