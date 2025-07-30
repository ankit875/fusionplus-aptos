'use client'

import { Input } from '@/components/ui/input'

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  readOnly?: boolean
}

export function AmountInput({ value, onChange, placeholder = "0.0", readOnly = false }: AmountInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    // Only allow numbers and decimal point
    if (/^\d*\.?\d*$/.test(newValue)) {
      onChange(newValue)
    }
  }

  return (
    <Input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      readOnly={readOnly}
      className="text-right text-lg font-medium"
    />
  )
}
