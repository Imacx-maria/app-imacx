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
        
        // First, get the Designer role ID by name
        const { data: roleDataArray, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'DESIGNER')
          .limit(1)

        if (roleError) {
          console.error('Error fetching designer role:', roleError)
          setLoading(false)
          return
        }

        const roleData = roleDataArray?.[0]
        if (!roleData?.id) {
          console.error('Designer role not found')
          setLoading(false)
          return
        }

        // Now fetch all profiles with that role_id
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, first_name')
          .eq('role_id', roleData.id)
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

  const handleValueChange = (newValue: string) => {
    // If user selects the "unselect" option, pass empty string to parent
    if (newValue === '__unselect__') {
      onChange('')
    } else {
      onChange(newValue)
    }
  }

  return (
    <div className={className}>
      {showLabel && label && <Label className="mb-2 block">{label}</Label>}
      <Select value={value || '__unselect__'} onValueChange={handleValueChange} disabled={disabled || loading}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {designers.length === 0 ? (
            <SelectItem value="__empty__" disabled>
              No designers found
            </SelectItem>
          ) : (
            <>
              <SelectItem value="__unselect__">
                <span className="text-orange-500 italic">Designer</span>
              </SelectItem>
              {designers.map((designer) => (
                <SelectItem key={designer.id} value={designer.id}>
                  {designer.label}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

