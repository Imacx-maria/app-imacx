"use client"

import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Check } from "lucide-react";

export interface SimpleNotasPopoverProps {
  value: string;
  onSave: (val: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  buttonSize?: "default" | "sm" | "lg" | "icon";
}

const SimpleNotasPopover: React.FC<SimpleNotasPopoverProps> = ({
  value,
  onSave,
  placeholder = "Adicionar notas...",
  disabled = false,
  className = "",
  label = "Notas",
  buttonSize = "icon",
}) => {
  const [open, setOpen] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(value);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  React.useEffect(() => {
    if (open) setLocalValue(value);
  }, [open, value]);

  const handleSave = async () => {
    if (disabled || isSaving) return;
    setIsSaving(true);
    await onSave(localValue);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => {
      setOpen(false);
      setSaveSuccess(false);
    }, 1000);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={value && value.trim() !== "" ? "link" : "ghost"}
          size={buttonSize}
          className={className}
          aria-label={label}
          disabled={disabled}
        >
          <FileText className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-background">
        <Textarea
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          placeholder={placeholder}
          disabled={disabled || isSaving}
          className="mb-4 min-h-[80px]"
        />
        <Button
          onClick={handleSave}
          disabled={disabled || isSaving}
          className="w-full"
        >
          {saveSuccess ? (
            <>
              <Check className="h-4 w-4 mr-1" /> Guardado
            </>
          ) : isSaving ? (
            "A guardar..."
          ) : (
            "Guardar"
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default SimpleNotasPopover; 