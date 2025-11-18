"use client";

import React, { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

interface SiglasInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * SiglasInput - Componente para gerir siglas de utilizadores
 * Permite adicionar/remover siglas individualmente com UI de badges/tags
 *
 * Exemplo de uso:
 * <SiglasInput
 *   value={siglas}
 *   onChange={setSiglas}
 *   label="SIGLAS DO FUNCIONÁRIO"
 * />
 */
const SiglasInput: React.FC<SiglasInputProps> = ({
  value = [],
  onChange,
  label = "SIGLAS",
  placeholder = "Digite uma sigla e pressione Enter",
  className = "",
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState("");

  const handleAddSigla = () => {
    const trimmedValue = inputValue.trim().toUpperCase();

    if (!trimmedValue) return;

    // Verificar se a sigla já existe
    if (value.includes(trimmedValue)) {
      alert("Esta sigla já foi adicionada");
      return;
    }

    // Adicionar nova sigla
    onChange([...value, trimmedValue]);
    setInputValue("");
  };

  const handleRemoveSigla = (siglaToRemove: string) => {
    onChange(value.filter((s) => s !== siglaToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSigla();
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}

      {/* Input para adicionar novas siglas */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={20}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAddSigla}
          disabled={disabled || !inputValue.trim()}
          className="h-10 w-10"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Lista de siglas adicionadas */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 p-3 rounded-md imx-border bg-muted/50">
          {value.map((sigla, index) => (
            <div
              key={`${sigla}-${index}`}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              <span>{sigla}</span>
              <button
                type="button"
                onClick={() => handleRemoveSigla(sigla)}
                disabled={disabled}
                className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5 transition-colors"
                aria-label={`Remover sigla ${sigla}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mensagem quando não há siglas */}
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          Nenhuma sigla adicionada. As siglas servem para agrupar comissões nos
          mapas de vendas.
        </p>
      )}

      {/* Contador de siglas */}
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {value.length}{" "}
          {value.length === 1 ? "sigla adicionada" : "siglas adicionadas"}
        </p>
      )}
    </div>
  );
};

export default SiglasInput;
