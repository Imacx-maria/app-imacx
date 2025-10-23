import Combobox from './Combobox'

interface ComplexidadeComboboxProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  className?: string
}

export function ComplexidadeCombobox({
  value,
  onChange,
  options,
  placeholder = 'Selecione complexidade',
  disabled = false,
  loading = false,
  className,
}: ComplexidadeComboboxProps) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      disabled={disabled || loading}
      buttonClassName={className}
      maxWidth="400px"
    />
  )
}

