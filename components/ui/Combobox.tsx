'use client'

import React, { useState, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import { Label } from '@/components/ui/label'

export interface ComboboxOption {
  value: string
  label: string
}

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  label?: string
  disabled?: boolean
  loading?: boolean
  error?: string | null
  className?: string
  buttonClassName?: string
  searchPlaceholder?: string
  emptyMessage?: string
  loadingMessage?: string
  maxWidth?: string
}

const Combobox: React.FC<ComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecionar',
  label,
  disabled = false,
  loading = false,
  error = null,
  className = '',
  buttonClassName = '',
  searchPlaceholder,
  emptyMessage = 'Nenhuma opção encontrada.',
  loadingMessage = 'Procurando...',
  maxWidth = '160px',
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filteredOptions, setFilteredOptions] =
    useState<ComboboxOption[]>(options)

  // Get the selected item's label from the value
  const selectedLabel = value
    ? options.find((option) => option.value === value)?.label || ''
    : ''

  // Filter options as user types
  useEffect(() => {
    if (!open) return

    const searchValue = search?.trim() || ''
    const filtered = searchValue
      ? options.filter((opt) => {
          const label = opt.label.toLowerCase()
          const searchTerm = searchValue.toLowerCase()
          return (
            label.startsWith(searchTerm) || label.includes(` ${searchTerm}`)
          )
        })
      : options

    setFilteredOptions(filtered)
  }, [search, open, options])

  // Debounce search updates to prevent too many re-renders
  const debouncedSetSearch = useDebounce((val: string) => setSearch(val), 300)

  // Generate IDs for accessibility
  const comboboxId = React.useId()
  const labelId = label ? `${comboboxId}-label` : undefined
  const errorId = error ? `${comboboxId}-error` : undefined

  return (
    <div className={className}>
      {label && (
        <Label id={labelId} htmlFor={comboboxId} className="mb-1 block">
          {label}
        </Label>
      )}
      <div
        className={`relative w-full max-w-[${maxWidth}]`}
        style={{ maxWidth }}
      >
        <Popover open={open && !disabled} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={comboboxId}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-labelledby={labelId}
              aria-invalid={!!error}
              aria-describedby={errorId}
              className={cn(
                'w-full justify-between border',
                error ? 'border-destructive' : 'border-border',
                buttonClassName,
              )}
              disabled={disabled || loading}
            >
              <span className="max-w-[85%] truncate">
                {value && selectedLabel ? selectedLabel : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="max-h-[300px] w-full p-0 !border !border-border overflow-hidden"
            align="start"
            side="bottom"
            sideOffset={4}
            avoidCollisions={true}
            collisionPadding={8}
          >
            <Command>
              <CommandInput
                placeholder={
                  searchPlaceholder ||
                  (placeholder
                    ? `Pesquisar ${placeholder.toLowerCase()}...`
                    : 'Pesquisar...')
                }
                className="h-9"
                onValueChange={debouncedSetSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {loading ? loadingMessage : emptyMessage}
                </CommandEmpty>
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => {
                        onChange(option.value)
                        setOpen(false)
                      }}
                      className="text-sm"
                    >
                      <span className="truncate">{option.label}</span>
                      <Check
                        className={cn(
                          'ml-auto h-4 w-4',
                          value === option.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <div id={errorId} className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

export default Combobox

