import React, { useState, memo } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import {
  CreatableCombobox,
  CreatableComboboxOption,
} from '@/components/custom/CreatableCombobox'

export interface TransportadoraOption {
  value: string
  label: string
}

interface CreatableTransportadoraComboboxProps {
  value: string
  onChange: (value: string) => void
  options: TransportadoraOption[]
  onOptionsUpdate?: (newOptions: TransportadoraOption[]) => void
  placeholder?: string
  className?: string
  buttonClassName?: string
  disabled?: boolean
}

const CreatableTransportadoraComboboxInternal: React.FC<
  CreatableTransportadoraComboboxProps
> = ({
  value,
  onChange,
  options,
  onOptionsUpdate,
  placeholder = 'Selecionar transportadora...',
  className = '',
  buttonClassName = '',
  disabled = false,
}) => {
  const [isCreating, setIsCreating] = useState(false)
  const supabase = createBrowserClient()

  const handleCreateNew = async (
    inputValue: string,
  ): Promise<CreatableComboboxOption | null> => {
    if (!inputValue.trim()) return null

    setIsCreating(true)

    try {
      // Insert new transportadora into Supabase
      const { data, error } = await supabase
        .from('transportadora')
        .insert({
          name: inputValue.trim(),
        })
        .select('*')
        .single()

      if (error) {
        console.error('Error creating transportadora:', error)
        return null
      }

      if (data) {
        const newOption: TransportadoraOption = {
          value: data.id.toString(),
          label: data.name,
        }

        // Update the options list
        const updatedOptions = [...options, newOption]
        if (onOptionsUpdate) {
          onOptionsUpdate(updatedOptions)
        }

        return {
          value: newOption.value,
          label: newOption.label,
        }
      }

      return null
    } catch (error) {
      console.error('Error creating transportadora:', error)
      return null
    } finally {
      setIsCreating(false)
    }
  }

  const wrapperClassName =
    className && className.trim() !== '' ? className : 'max-w-[220px]'

  return (
    <div className={wrapperClassName}>
      <CreatableCombobox
        value={value}
        onChange={onChange}
        onCreateNew={handleCreateNew}
        options={options.map((opt) => ({ value: opt.value, label: opt.label }))}
        placeholder={placeholder}
        searchPlaceholder="Procurar transportadora..."
        createMessage="Criar transportadora"
        loading={isCreating}
        buttonClassName={buttonClassName}
        disabled={disabled}
      />
    </div>
  )
}

const CreatableTransportadoraCombobox = memo(CreatableTransportadoraComboboxInternal);

export default CreatableTransportadoraCombobox
