'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  FileText,
  Check,
  TriangleAlertIcon,
  CircleAlertIcon,
  BellRingIcon,
  MessageCircleIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Portal } from '@radix-ui/react-popover'

export interface NotasPopoverProps {
  value: string
  onChange: (val: string) => void
  onSave: (fields: {
    outras: string
    contacto_entrega: string
    telefone_entrega: string
    data?: string | null
  }) => Promise<void> | void
  placeholder?: string
  disabled?: boolean
  className?: string
  iconType?: 'warning' | 'error' | 'info' | 'notification' | 'file' | 'auto'
  label?: string
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon'
  maxTextareaHeight?: string
  saveOnBlur?: boolean
  contacto_entrega?: string
  telefone_entrega?: string
  data?: string | null
  onFieldChange?: (fields: {
    outras: string
    contacto_entrega: string
    telefone_entrega: string
    data?: string | null
  }) => void
  popoverContainer?: HTMLElement | null
  modal?: boolean
  /**
   * If true, the popover content is rendered centered in the viewport using a Portal.
   * Useful for usage inside Drawers or modals to avoid clipping/freeze issues.
   */
  centered?: boolean
}

const NotasPopover: React.FC<NotasPopoverProps> = ({
  value,
  onChange,
  onSave,
  placeholder = 'Adicionar outras...',
  disabled = false,
  className = '',
  iconType = 'auto',
  label,
  buttonSize = 'icon',
  maxTextareaHeight = '200px',
  saveOnBlur = false,
  contacto_entrega = '',
  telefone_entrega = '',
  data = null,
  onFieldChange,
  popoverContainer,
  modal = true,
  centered = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [localOutras, setLocalOutras] = useState(value)
  const [localContactoEntrega, setLocalContactoEntrega] =
    useState(contacto_entrega)
  const [localTelefoneEntrega, setLocalTelefoneEntrega] =
    useState(telefone_entrega)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [originalFields, setOriginalFields] = useState({
    outras: value,
    contacto_entrega,
    telefone_entrega,
  })

  // Generate unique IDs for accessibility
  const popoverDescriptionId = React.useId()
  const labelId = React.useId()

  // Only sync local state when popover is opened
  useEffect(() => {
    if (isOpen) {
      setLocalOutras(value)
      setLocalContactoEntrega(contacto_entrega)
      setLocalTelefoneEntrega(telefone_entrega)
      setOriginalFields({
        outras: value,
        contacto_entrega,
        telefone_entrega,
      })
      setSaveSuccess(false)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      }, 50)
    }
  }, [isOpen, contacto_entrega, telefone_entrega, value])

  const handleSave = async () => {
    if (disabled || isSaving) return
    try {
      setIsSaving(true)
      const fields = {
        data: null, // No longer managing data in this component
        outras: localOutras,
        contacto_entrega: localContactoEntrega,
        telefone_entrega: localTelefoneEntrega,
      }
      // Only save if any value has changed
      const changed = Object.keys(originalFields).some(
        (key) =>
          fields[key as keyof typeof originalFields] !==
          originalFields[key as keyof typeof originalFields],
      )
      if (changed) {
        await onSave(fields)
      }
      setSaveSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
        setTimeout(() => setSaveSuccess(false), 300)
      }, 1500)
    } catch (err) {
      console.error('[NotasPopover] Error during save:', err)
      alert('Erro ao guardar outras')
    } finally {
      setIsSaving(false)
    }
  }

  // Save on blur if enabled
  const handleBlur = () => {
    const fields = {
      outras: localOutras,
      contacto_entrega: localContactoEntrega,
      telefone_entrega: localTelefoneEntrega,
    }
    const changed = Object.keys(originalFields).some(
      (key) =>
        fields[key as keyof typeof originalFields] !==
        originalFields[key as keyof typeof originalFields],
    )
    if (saveOnBlur && changed && !isSaving) {
      handleSave()
    }
  }

  // Handle field changes
  const handleFieldChange = (
    field: keyof typeof originalFields,
    value: string,
  ) => {
    const newFields = {
      data: null, // No longer managing data in this component
      outras: field === 'outras' ? value : localOutras,
      contacto_entrega:
        field === 'contacto_entrega' ? value : localContactoEntrega,
      telefone_entrega:
        field === 'telefone_entrega' ? value : localTelefoneEntrega,
    }
    setLocalOutras(newFields.outras)
    setLocalContactoEntrega(newFields.contacto_entrega)
    setLocalTelefoneEntrega(newFields.telefone_entrega)
    if (onFieldChange) onFieldChange(newFields)
    if (field === 'outras') onChange(value)
  }

  // Choose icon based on type and content
  const getIcon = () => {
    // If auto and has content, show content icon
    if (iconType === 'auto') {
      if (value?.trim()) return <MessageCircleIcon className="h-4 w-4" />
      return <MessageCircleIcon className="h-4 w-4 opacity-50" />
    }
    // Otherwise show specified icon
    switch (iconType) {
      case 'warning':
        return <TriangleAlertIcon className="h-4 w-4" />
      case 'error':
        return <CircleAlertIcon className="h-4 w-4" />
      case 'notification':
        return <BellRingIcon className="h-4 w-4" />
      case 'file':
        return <FileText className="h-4 w-4" />
      default:
        return <MessageCircleIcon className="h-4 w-4" />
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }

    // Close on Escape, but only if not handled by Popover already
    if (e.key === 'Escape') {
      if (localOutras !== originalFields.outras) {
        // Revert changes if Escape is pressed
        setLocalOutras(originalFields.outras)
        setLocalContactoEntrega(originalFields.contacto_entrega)
        setLocalTelefoneEntrega(originalFields.telefone_entrega)
      }
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant={value && value.trim() !== '' ? 'link' : 'ghost'}
          size={buttonSize}
          className={className}
          aria-label={
            label ||
            (value ? 'Ver ou editar outras existentes' : 'Adicionar outras')
          }
          disabled={disabled}
        >
          {getIcon()}
          <span className="sr-only">{label}</span>
        </Button>
      </PopoverTrigger>
      {centered ? (
        <Portal>
          <PopoverContent
            side={undefined}
            align={undefined}
            className="bg-background  fixed top-1/2 left-1/2 z-[9999] max-h-[70vh] w-96 -translate-x-1/2 -translate-y-1/2 overflow-auto imx-border p-4 shadow-2xl"
            aria-describedby={popoverDescriptionId}
            data-no-aria-hidden="true"
            onEscapeKeyDown={() => {
              setLocalOutras(originalFields.outras)
              setLocalContactoEntrega(originalFields.contacto_entrega)
              setLocalTelefoneEntrega(originalFields.telefone_entrega)
            }}
          >
            <div id={popoverDescriptionId} className="sr-only">
              Editor de outras: {label || 'Editar e guardar outras'}
            </div>
            {label && (
              <div id={labelId} className="mb-2 font-medium">
                {label}
              </div>
            )}

            <div className="mb-6">
              <label className="mb-1 block text-xs font-semibold">Outras</label>
              <Textarea
                ref={textareaRef}
                value={localOutras}
                placeholder={placeholder}
                className={`min-h-[80px] max-h-[${maxTextareaHeight}]`}
                style={{ maxHeight: maxTextareaHeight }}
                onChange={(e) => handleFieldChange('outras', e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled || isSaving}
                aria-label="Outras"
                aria-labelledby={label ? labelId : undefined}
              />
            </div>
            <div className="mb-2">
              <label className="mb-1 block text-xs font-semibold">
                Contacto Entrega
              </label>
              <Input
                type="text"
                value={localContactoEntrega}
                onChange={(e) =>
                  handleFieldChange('contacto_entrega', e.target.value)
                }
                disabled={disabled || isSaving}
                placeholder="Nome do contacto de entrega"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">
                Telefone Entrega
              </label>
              <Input
                type="text"
                value={localTelefoneEntrega}
                onChange={(e) =>
                  handleFieldChange('telefone_entrega', e.target.value)
                }
                disabled={disabled || isSaving}
                placeholder="Telefone de entrega"
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-muted-foreground text-xs">
                {isSaving
                  ? 'A guardar...'
                  : saveOnBlur
                    ? 'Guarda automaticamente ao sair'
                    : ''}
              </div>
              <Button
                variant={saveSuccess ? 'outline' : 'default'}
                size="sm"
                onClick={handleSave}
                disabled={disabled || isSaving}
                className="relative"
                aria-label="Guardar outras"
              >
                {saveSuccess ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Guardado
                  </>
                ) : isSaving ? (
                  'A guardar...'
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </PopoverContent>
        </Portal>
      ) : (
        <PopoverContent
          side="top"
          align="center"
          className="bg-background  z-[9999] max-h-[70vh] w-96 overflow-auto imx-border p-4"
          aria-describedby={popoverDescriptionId}
          data-no-aria-hidden="true"
          onEscapeKeyDown={() => {
            setLocalOutras(originalFields.outras)
            setLocalContactoEntrega(originalFields.contacto_entrega)
            setLocalTelefoneEntrega(originalFields.telefone_entrega)
          }}
        >
          <div id={popoverDescriptionId} className="sr-only">
            Editor de outras: {label || 'Editar e guardar outras'}
          </div>
          {label && (
            <div id={labelId} className="mb-2 font-medium">
              {label}
            </div>
          )}
          <div className="mb-6">
            <label className="mb-1 block text-xs font-semibold">Outras</label>
            <Textarea
              ref={textareaRef}
              value={localOutras}
              placeholder={placeholder}
              className={`min-h-[80px] max-h-[${maxTextareaHeight}]`}
              style={{ maxHeight: maxTextareaHeight }}
              onChange={(e) => handleFieldChange('outras', e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              disabled={disabled || isSaving}
              aria-label="Outras"
              aria-labelledby={label ? labelId : undefined}
            />
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-xs font-semibold">
              Contacto Entrega
            </label>
            <Input
              type="text"
              value={localContactoEntrega}
              onChange={(e) =>
                handleFieldChange('contacto_entrega', e.target.value)
              }
              disabled={disabled || isSaving}
              placeholder="Nome do contacto de entrega"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold">
              Telefone Entrega
            </label>
            <Input
              type="text"
              value={localTelefoneEntrega}
              onChange={(e) =>
                handleFieldChange('telefone_entrega', e.target.value)
              }
              disabled={disabled || isSaving}
              placeholder="Telefone de entrega"
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-muted-foreground text-xs">
              {isSaving
                ? 'A guardar...'
                : saveOnBlur
                  ? 'Guarda automaticamente ao sair'
                  : ''}
            </div>
            <Button
              variant={saveSuccess ? 'outline' : 'default'}
              size="sm"
              onClick={handleSave}
              disabled={disabled || isSaving}
              className="relative"
              aria-label="Guardar outras"
            >
              {saveSuccess ? (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  Guardado
                </>
              ) : isSaving ? (
                'A guardar...'
              ) : (
                'Guardar'
              )}
            </Button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
}

export default NotasPopover
