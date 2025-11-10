// Stock input field components with proper sizing and validation
// Applies Single Responsibility Principle and Interface Segregation

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { 
  validateQuantity, 
  validatePrice, 
  validateGuideNumber, 
  validateReferenceCode,
  FIELD_LIMITS,
  type ValidationResult
} from './validation'
import { cn } from '@/lib/utils'

// Base props interface
export interface FieldProps {
  id?: string
  label?: string
  required?: boolean
  error?: string | null
  disabled?: boolean
  className?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
}

// Numeric input field with validation
export interface NumericFieldProps extends FieldProps {
  value: string | number
  type?: 'text' | 'number'
  min?: number
  max?: number
  maxLength?: number
  placeholder?: string
  allowDecimals?: boolean
}

// Specialized field components following Interface Segregation
export const StockNumberField: React.FC<NumericFieldProps> = ({
  id,
  label = 'Quantity',
  value,
  type = 'text',
  maxLength = FIELD_LIMITS.QUANTITY,
  placeholder = '0',
  required = false,
  error,
  disabled = false,
  className,
  onChange,
  onBlur,
  onFocus,
  allowDecimals = true,
  ...props
}) => {
  const [localError, setLocalError] = React.useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value

    // Apply input restrictions
    if (allowDecimals) {
      // Allow only numbers and decimal points
      newValue = newValue.replace(/[^0-9.]/g, '')
      // Only allow one decimal point
      const parts = newValue.split('.')
      if (parts.length > 2) {
        newValue = parts[0] + '.' + parts.slice(1).join('')
      }
    } else {
      // Allow only numbers
      newValue = newValue.replace(/[^0-9]/g, '')
    }

    // Apply max length
    if (newValue.length > maxLength) {
      newValue = newValue.slice(0, maxLength)
    }

    // Validate if we have a value
    if (newValue) {
      const validation: ValidationResult = validateQuantity(newValue)
      setLocalError(validation.isValid ? null : validation.errors[0]?.message || null)
    } else {
      setLocalError(null)
    }

    onChange?.(newValue)
  }

  const displayError = error || localError

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <Label 
          htmlFor={id} 
          className={cn(
            'text-xs font-medium block',
            required && 'after:content-["*"] after:ml-0.5 after:text-red-500'
          )}
        >
          {label}
        </Label>
      )}
      <Input
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'h-10',
          displayError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          'text-sm'
        )}
        maxLength={maxLength}
        {...props}
      />
      {displayError && (
        <p className="text-xs text-red-600 mt-1">{displayError}</p>
      )}
    </div>
  )
}

// Price field with currency formatting
export const PriceField: React.FC<NumericFieldProps> = ({
  id,
  label = 'Unit Price',
  value,
  placeholder = '0.00',
  maxLength = FIELD_LIMITS.PRICE,
  required = false,
  error,
  disabled = false,
  className,
  onChange,
  onBlur,
  onFocus,
  ...props
}) => {
  const [localError, setLocalError] = React.useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value

    // Allow only numbers and decimal points
    newValue = newValue.replace(/[^0-9.]/g, '')
    
    // Only allow one decimal point
    const parts = newValue.split('.')
    if (parts.length > 2) {
      newValue = parts[0] + '.' + parts.slice(1).join('')
    }

    // Apply max length
    if (newValue.length > maxLength) {
      newValue = newValue.slice(0, maxLength)
    }

    // Validate if we have a value
    if (newValue) {
      const validation: ValidationResult = validatePrice(newValue)
      setLocalError(validation.isValid ? null : validation.errors[0]?.message || null)
    } else {
      setLocalError(null)
    }

    onChange?.(newValue)
  }

  const displayError = error || localError

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <Label 
          htmlFor={id} 
          className={cn(
            'text-xs font-medium block',
            required && 'after:content-["*"] after:ml-0.5 after:text-red-500'
          )}
        >
          {label}
        </Label>
      )}
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'h-10 pl-8',
            displayError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            'text-sm'
          )}
          maxLength={maxLength}
          {...props}
        />
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
          €
        </span>
      </div>
      {displayError && (
        <p className="text-xs text-red-600 mt-1">{displayError}</p>
      )}
    </div>
  )
}

// Text field with character limits
export const TextField: React.FC<FieldProps & {
  value: string
  maxLength?: number
  placeholder?: string
  pattern?: string
  transform?: (value: string) => string
}> = ({
  id,
  label,
  value,
  maxLength = FIELD_LIMITS.REFERENCE_CODE,
  placeholder = '',
  pattern,
  transform,
  required = false,
  error,
  disabled = false,
  className,
  onChange,
  onBlur,
  onFocus,
  ...props
}) => {
  const [localError, setLocalError] = React.useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let newValue = e.target.value

    // Apply transformation if provided
    if (transform) {
      newValue = transform(newValue)
    }

    // Apply max length
    if (newValue.length > maxLength) {
      newValue = newValue.slice(0, maxLength)
    }

    // Validate pattern if provided
    if (pattern && newValue && !newValue.match(new RegExp(pattern))) {
      setLocalError(`Invalid format`)
    } else {
      setLocalError(null)
    }

    onChange?.(newValue)
  }

  const displayError = error || localError
  const isTextarea = maxLength > 50 // Use textarea for longer fields

  const FieldComponent = isTextarea ? Textarea : Input

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <Label 
          htmlFor={id} 
          className={cn(
            'text-xs font-medium block',
            required && 'after:content-["*"] after:ml-0.5 after:text-red-500'
          )}
        >
          {label}
        </Label>
      )}
      <FieldComponent
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          isTextarea ? 'min-h-[80px] resize-none' : 'h-10',
          displayError && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          'text-sm'
        )}
        maxLength={maxLength}
        {...props}
      />
      {displayError && (
        <p className="text-xs text-red-600 mt-1">{displayError}</p>
      )}
    </div>
  )
}

// Specialized field for supplier selection
export const SupplierField: React.FC<FieldProps & {
  value: string
  suppliers: Array<{ id: string; nome_forn: string }>
  placeholder?: string
  onSelect: (supplierId: string) => void
}> = ({
  id,
  label = 'Supplier',
  value,
  suppliers,
  placeholder = 'Select supplier...',
  required = false,
  error,
  disabled = false,
  className,
  onSelect,
  onBlur,
  onFocus,
  ...props
}) => {
  const selectedSupplier = suppliers.find(s => s.id === value)

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <Label 
          htmlFor={id} 
          className={cn(
            'text-xs font-medium block',
            required && 'after:content-["*"] after:ml-0.5 after:text-red-500'
          )}
        >
          {label}
        </Label>
      )}
      <Select 
        value={value} 
        onValueChange={onSelect} 
        disabled={disabled}
      >
        <SelectTrigger 
          id={id}
          className={cn(
            'h-10',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            'text-sm',
            selectedSupplier?.nome_forn && selectedSupplier.nome_forn.length > FIELD_LIMITS.SUPPLIER_NUMBER 
              && 'text-xs truncate' // Apply 6-char max styling when exceeded
          )}
          
          {...props}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {suppliers.map((supplier) => (
            <SelectItem 
              key={supplier.id} 
              value={supplier.id}
              className="text-sm"
            >
              {supplier.nome_forn.length > FIELD_LIMITS.SUPPLIER_NUMBER 
                ? supplier.nome_forn.slice(0, FIELD_LIMITS.SUPPLIER_NUMBER) + '...'
                : supplier.nome_forn
              }
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  )
}

// Field group component for logical grouping
export interface FieldGroupProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  columns?: 1 | 2 | 3 | 4 | 6
}

export const FieldGroup: React.FC<FieldGroupProps> = ({
  title,
  description,
  children,
  className,
  columns = 2
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  }

  return (
    <div className={cn('space-y-4', className)}>
      {title && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      <div className={cn('grid gap-4', gridCols[columns])}>
        {children}
      </div>
    </div>
  )
}