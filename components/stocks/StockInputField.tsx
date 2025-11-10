import React from 'react'
import { Input } from '@/components/ui/input'

interface StockInputFieldProps {
  value: string | number
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number' | 'date'
  maxLength?: number
  max?: number
  className?: string
  onBlur?: () => void
  defaultValue?: string | number
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  disabled?: boolean
}

/**
 * Reusable input field for stock management forms and tables
 *
 * Features:
 * - Supports text, number, and date input types
 * - Automatic maxLength validation
 * - Number inputs hide spinners (better UX for stock quantities)
 * - Consistent h-10 height with optional override
 * - OnBlur support for inline table editing
 *
 * Usage:
 * ```tsx
 * // Text input with maxLength
 * <StockInputField
 *   placeholder="Nº Guia"
 *   value={noGuia}
 *   onChange={setNoGuia}
 *   maxLength={20}
 * />
 *
 * // Number input (spinners hidden)
 * <StockInputField
 *   type="number"
 *   placeholder="Qt. Palete"
 *   value={quantity}
 *   onChange={setQuantity}
 *   maxLength={6}
 *   max={999999}
 * />
 *
 * // Inline table editing with onBlur
 * <StockInputField
 *   type="number"
 *   value={editValue}
 *   onChange={setEditValue}
 *   onBlur={handleSave}
 *   className="h-8"
 * />
 * ```
 */
export function StockInputField({
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  max,
  className,
  onBlur,
  defaultValue,
  inputMode,
  disabled = false,
}: StockInputFieldProps) {
  // Default className includes h-10 and number spinner removal
  const defaultClassName = type === 'number'
    ? 'h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
    : 'h-10'

  // Merge with custom className if provided
  const finalClassName = className || defaultClassName

  return (
    <Input
      type={type}
      inputMode={inputMode}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      maxLength={maxLength}
      max={max}
      defaultValue={defaultValue}
      className={finalClassName}
      disabled={disabled}
    />
  )
}
