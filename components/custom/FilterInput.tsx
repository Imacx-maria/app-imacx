"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import React, { useEffect, useState, memo } from "react";

interface FilterInputProps {
  value: string;
  onChange: (value: string) => void;
  onFilterChange?: (effective: string) => void;
  placeholder?: string;
  minChars?: number;
  debounceMs?: number;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

const FilterInputInternal = ({
  value,
  onChange,
  onFilterChange,
  placeholder,
  minChars = 3,
  debounceMs = 300,
  className,
  inputClassName,
  disabled,
}: FilterInputProps) => {
  const [internal, setInternal] = useState(value);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  useEffect(() => {
    if (!onFilterChange) return;

    const trimmed = internal.trim();
    const timeout = setTimeout(() => {
      const effective = trimmed.length >= minChars ? trimmed : "";
      onFilterChange(effective);
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [internal, minChars, debounceMs, onFilterChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);
    setInternal(next);
  };

  const handleClear = () => {
    onChange("");
    setInternal("");
    if (onFilterChange) onFilterChange("");
  };

  const showClear = !disabled && internal !== "";

  return (
    <div className={cn("relative", className)}>
      <Input
        value={internal}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("pr-8", inputClassName)}
      />
      {showClear && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Limpar filtro"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export const FilterInput = memo(FilterInputInternal);
