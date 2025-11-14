import React from 'react'

interface InlineEditFieldProps {
  id: string
  defaultValue: string | number
  onChange: (value: string | number) => void
  type?: 'text' | 'numeric'
  maxLength?: number
  placeholder?: string
  className?: string
  width?: string
}

/**
 * Uncontrolled input field for inline table editing in stock management
 *
 * Features:
 * - Uncontrolled input (uses defaultValue)
 * - onBlur triggers save
 * - Enter key triggers save and blur
 * - Automatic numeric validation for numeric type
 * - Consistent styling with Input component
 *
 * Usage:
 * ```tsx
 * // Numeric input with validation
 * <InlineEditField
 *   id={`${entry.id}-quantidade`}
 *   defaultValue={entry.quantidade || ''}
 *   onChange={(value) => updateEntry(index, 'quantidade', value)}
 *   type="numeric"
 *   maxLength={6}
 *   placeholder="0"
 * />
 *
 * // Text input
 * <InlineEditField
 *   id={`${entry.id}-no_guia_forn`}
 *   defaultValue={entry.no_guia_forn || ''}
 *   onChange={(value) => updateEntry(index, 'no_guia_forn', value)}
 *   maxLength={20}
 *   placeholder="Opcional"
 * />
 * ```
 */
export function InlineEditField({
  id,
  defaultValue,
  onChange,
  type = 'text',
  maxLength,
  placeholder,
  className,
  width,
}: InlineEditFieldProps) {
  const handleChange = (value: string) => {
    if (type === 'numeric') {
      // Remove non-numeric characters
      const numericValue = value.replace(/[^0-9]/g, '')
      onChange(numericValue ? parseInt(numericValue) : 0)
    } else {
      onChange(value)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    handleChange(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleChange(e.currentTarget.value)
      e.currentTarget.blur()
    }
  }

  // Default className matches Input component
  const defaultClassName =
    'flex h-10 w-full rounded-md imx-border  bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

  const finalClassName = className || defaultClassName

  return (
    <input
      key={id}
      type="text"
      inputMode={type === 'numeric' ? 'numeric' : 'text'}
      defaultValue={defaultValue}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      maxLength={maxLength}
      className={finalClassName}
      placeholder={placeholder}
      style={width ? { width } : undefined}
    />
  )
}
