'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const DESIGNER_ROLE_ID = '3132fced-ae83-4f56-9d15-c92c3ef6b6ae'

export interface DesignerOption {
  value: string
  label: string
  id: string
}

interface CreatableDesignerComboboxProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  showLabel?: boolean
}

export default function CreatableDesignerCombobox({
  value,
  onChange,
  label = 'Designer',
  placeholder = 'Select designer...',
  disabled = false,
  className = '',
  showLabel = true,
}: CreatableDesignerComboboxProps) {
  const [designers, setDesigners] = useState<DesignerOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDesigners = async () => {
      try {
        const supabase = createBrowserClient()
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, first_name')
          .eq('role_id', DESIGNER_ROLE_ID)
          .order('first_name', { ascending: true })

        if (error) {
          console.error('Error fetching designers:', error)
          return
        }

        if (data) {
          const options: DesignerOption[] = data.map((d) => ({
            value: d.user_id,
            label: d.first_name || 'Unknown',
            id: d.user_id,
          }))
          setDesigners(options)
        }
      } catch (error) {
        console.error('Error loading designers:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDesigners()
  }, [])

  return (
    <div className={className}>
      {showLabel && label && <Label className="mb-2 block">{label}</Label>}
      <Select value={value || ''} onValueChange={onChange} disabled={disabled || loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {designers.length === 0 ? (
            <SelectItem value="__empty__" disabled>
              No designers found
            </SelectItem>
          ) : (
            designers.map((designer) => (
              <SelectItem key={designer.id} value={designer.id}>
                {designer.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

