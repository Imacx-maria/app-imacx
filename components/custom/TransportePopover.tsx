'use client'

import React, { useState, useEffect } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Check, Truck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import CreatableArmazemCombobox, {
  ArmazemOption,
} from '@/components/forms/CreatableArmazemCombobox'
import CreatableTransportadoraCombobox, {
  TransportadoraOption,
} from '@/components/forms/CreatableTransportadoraCombobox'
import { Portal } from '@radix-ui/react-popover'

export interface TransportePopoverProps {
  localRecolha: string
  localEntrega: string
  transportadora: string
  idLocalRecolha: string
  idLocalEntrega: string
  notas: string
  peso: string
  nrViaturas: string
  nrPaletes: string
  armazens: ArmazemOption[]
  transportadoras: TransportadoraOption[]
  onSave: (fields: {
    local_recolha: string
    local_entrega: string
    transportadora: string
    id_local_recolha: string
    id_local_entrega: string
    notas: string
    peso: string
    nr_viaturas: string
    nr_paletes: string
  }) => Promise<void> | void
  onArmazensUpdate?: () => Promise<void>
  onTransportadorasUpdate?: () => Promise<void>
  disabled?: boolean
  centered?: boolean
}

const TransportePopover: React.FC<TransportePopoverProps> = ({
  localRecolha,
  localEntrega,
  transportadora,
  idLocalRecolha,
  idLocalEntrega,
  notas,
  peso,
  nrViaturas,
  nrPaletes,
  armazens,
  transportadoras,
  onSave,
  onArmazensUpdate,
  onTransportadorasUpdate,
  disabled = false,
  centered = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [localIdRecolha, setLocalIdRecolha] = useState(idLocalRecolha)
  const [localIdEntrega, setLocalIdEntrega] = useState(idLocalEntrega)
  const [localTransportadora, setLocalTransportadora] = useState(transportadora)
  const [localNotas, setLocalNotas] = useState(notas)
  const [localPeso, setLocalPeso] = useState(peso)
  const [localNrViaturas, setLocalNrViaturas] = useState(nrViaturas)
  const [localNrPaletes, setLocalNrPaletes] = useState(nrPaletes)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [originalFields, setOriginalFields] = useState({
    id_local_recolha: idLocalRecolha,
    id_local_entrega: idLocalEntrega,
    transportadora: transportadora,
    notas: notas,
    peso: peso,
    nr_viaturas: nrViaturas,
    nr_paletes: nrPaletes,
  })

  const popoverDescriptionId = React.useId()

  useEffect(() => {
    if (isOpen) {
      setLocalIdRecolha(idLocalRecolha)
      setLocalIdEntrega(idLocalEntrega)
      setLocalTransportadora(transportadora)
      setLocalNotas(notas)
      setLocalPeso(peso)
      setLocalNrViaturas(nrViaturas)
      setLocalNrPaletes(nrPaletes)
      setOriginalFields({
        id_local_recolha: idLocalRecolha,
        id_local_entrega: idLocalEntrega,
        transportadora: transportadora,
        notas: notas,
        peso: peso,
        nr_viaturas: nrViaturas,
        nr_paletes: nrPaletes,
      })
      setSaveSuccess(false)
    }
  }, [isOpen, idLocalRecolha, idLocalEntrega, transportadora, notas, peso, nrViaturas, nrPaletes])

  const handleSave = async () => {
    if (disabled || isSaving) return
    try {
      setIsSaving(true)

      const selectedRecolha = armazens.find(
        (a) => a.value === localIdRecolha,
      )
      const selectedEntrega = armazens.find(
        (a) => a.value === localIdEntrega,
      )

      const fields = {
        local_recolha: selectedRecolha?.label || '',
        local_entrega: selectedEntrega?.label || '',
        transportadora: localTransportadora,
        id_local_recolha: localIdRecolha,
        id_local_entrega: localIdEntrega,
        notas: localNotas,
        peso: localPeso,
        nr_viaturas: localNrViaturas,
        nr_paletes: localNrPaletes,
      }

      const changed = Object.keys(originalFields).some(
        (key) =>
          fields[key as keyof typeof originalFields] !==
          originalFields[key as keyof typeof originalFields],
      )

      if (changed) {
        await onSave(fields)
      }

      setSaveSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
        setTimeout(() => setSaveSuccess(false), 300)
      }, 1500)
    } catch (err) {
      console.error('[TransportePopover] Error during save:', err)
      alert('Erro ao guardar transporte')
    } finally {
      setIsSaving(false)
    }
  }

  const content = (
    <>
      <div id={popoverDescriptionId} className="sr-only">
        Editor de transporte: editar local de recolha, local de entrega e
        transportadora
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-xs font-semibold">
          Local Recolha
        </label>
        <CreatableArmazemCombobox
          value={localIdRecolha}
          onChange={setLocalIdRecolha}
          options={armazens}
          onOptionsUpdate={onArmazensUpdate}
          placeholder="Selecionar..."
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-xs font-semibold">
          Local Entrega
        </label>
        <CreatableArmazemCombobox
          value={localIdEntrega}
          onChange={setLocalIdEntrega}
          options={armazens}
          onOptionsUpdate={onArmazensUpdate}
          placeholder="Selecionar..."
          className="w-full"
        />
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-xs font-semibold">Transportadora</label>
        <CreatableTransportadoraCombobox
          value={localTransportadora}
          onChange={setLocalTransportadora}
          options={transportadoras}
          onOptionsUpdate={onTransportadorasUpdate}
          placeholder="Selecionar..."
          disabled={disabled || isSaving}
        />
      </div>

      <div className="mb-4 border-t pt-4">
        <label className="mb-2 block text-xs font-semibold">Notas</label>
        <Textarea
          value={localNotas}
          placeholder="Adicionar notas..."
          className="min-h-[80px]"
          onChange={(e) => setLocalNotas(e.target.value)}
          disabled={disabled || isSaving}
        />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-4">
        <div>
          <label className="mb-2 block text-xs font-semibold">
            Peso
          </label>
          <Input
            type="text"
            value={localPeso}
            onChange={(e) => {
              const value = e.target.value
              if (value.length <= 6) {
                setLocalPeso(value)
              }
            }}
            disabled={disabled || isSaving}
            placeholder="Peso"
            maxLength={6}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold">
            Nº Viaturas
          </label>
          <Input
            type="text"
            value={localNrViaturas}
            onChange={(e) => {
              const value = e.target.value
              if (value.length <= 3) {
                setLocalNrViaturas(value)
              }
            }}
            disabled={disabled || isSaving}
            placeholder="Nº"
            maxLength={3}
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold">
            Nº Paletes
          </label>
          <Input
            type="text"
            value={localNrPaletes}
            onChange={(e) => {
              const value = e.target.value
              if (value.length <= 4) {
                setLocalNrPaletes(value)
              }
            }}
            disabled={disabled || isSaving}
            placeholder="Nº"
            maxLength={4}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant={saveSuccess ? 'outline' : 'default'}
          size="sm"
          onClick={handleSave}
          disabled={disabled || isSaving}
          className="ml-auto"
          aria-label="Guardar transporte"
        >
          {saveSuccess ? (
            <>
              <Check className="mr-1 h-4 w-4" />
              Guardado
            </>
          ) : isSaving ? (
            'A guardar...'
          ) : (
            'Guardar'
          )}
        </Button>
      </div>
    </>
  )

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className="transport-popover-trigger"
          aria-label="Editar transporte"
          disabled={disabled}
        >
          <Truck className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      {centered ? (
        <Portal>
          <PopoverContent
            side={undefined}
            align={undefined}
            className="bg-background border-border fixed top-1/2 left-1/2 z-[9999] w-96 -translate-x-1/2 -translate-y-1/2 border-2 p-4 shadow-2xl"
            aria-describedby={popoverDescriptionId}
            data-no-aria-hidden="true"
          >
            {content}
          </PopoverContent>
        </Portal>
      ) : (
        <PopoverContent
          side="top"
          align="center"
          className="bg-background border-border z-[9999] w-96 border-2 p-4"
          aria-describedby={popoverDescriptionId}
          data-no-aria-hidden="true"
        >
          {content}
        </PopoverContent>
      )}
    </Popover>
  )
}

export default TransportePopover
