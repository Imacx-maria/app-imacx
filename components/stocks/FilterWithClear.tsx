import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { XSquare } from "lucide-react";

interface FilterWithClearProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: "text" | "date" | "number";
  inputMode?:
    | "none"
    | "text"
    | "decimal"
    | "numeric"
    | "tel"
    | "search"
    | "email"
    | "url";
}

/**
 * Reusable filter input with clear button
 * Used across stocks and gestao pages to reduce code duplication
 */
export function FilterWithClear({
  value,
  onChange,
  placeholder = "",
  className = "h-10 pr-10 rounded-none",
  type = "text",
  inputMode,
}: FilterWithClearProps) {
  return (
    <div className="relative flex-1">
      <Input
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
      {value && (
        <Button
          variant="default"
          size="icon"
          className="absolute right-0 top-0 h-10 w-10"
          onClick={() => onChange("")}
          type="button"
        >
          <XSquare className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
