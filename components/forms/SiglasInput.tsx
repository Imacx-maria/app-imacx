'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SiglasInputProps {
  value: string | string[]
  onChange: (value: string[]) => void
  label?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

// Temporary placeholder component for SiglasInput
// This component provides basic input functionality for siglas (initials/abbreviations)
const SiglasInput: React.FC<SiglasInputProps> = ({
  value,
  onChange,
  label,
  placeholder = "Siglas",
  className,
  disabled = false
}) => {
  // Convert value to string for input
  const stringValue = Array.isArray(value) ? value.join(', ') : value

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convert comma-separated string to array
    const newValue = e.target.value
    const arrayValue = newValue ? newValue.split(',').map(s => s.trim()).filter(Boolean) : []
    onChange(arrayValue)
  }

  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      <Input
        type="text"
        value={stringValue}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={100}
        disabled={disabled}
      />
    </div>
  )
}

export default SiglasInput
