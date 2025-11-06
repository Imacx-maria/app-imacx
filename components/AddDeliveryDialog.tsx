'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import DatePicker from '@/components/ui/DatePicker'
import { createBrowserClient } from '@/utils/supabase'
import CreatableClienteCombobox from '@/components/forms/CreatableClienteCombobox'
import CreatableArmazemCombobox, {
  ArmazemOption,
} from '@/components/forms/CreatableArmazemCombobox'
import CreatableTransportadoraCombobox, {
  TransportadoraOption,
} from '@/components/forms/CreatableTransportadoraCombobox'

interface AddDeliveryDialogProps {
  onSuccess?: () => void
  armazens: ArmazemOption[]
  transportadoras: TransportadoraOption[]
  onArmazensUpdate?: () => void
  onTransportadorasUpdate?: () => void
}

interface DeliveryFormData {
  // Optional FO/ORC fields
  numero_fo?: string
  numero_orc?: number
  
  // Client info
  cliente?: string
  id_cliente?: string
  
  // Campaign/Item info
  nome_campanha?: string
  descricao?: string
  brindes?: boolean
  
  // Quantity
  quantidade?: number
  
  // Logistics info
  guia?: string
  data_saida?: Date | null
  
  // Transport info
  id_local_recolha?: string
  id_local_entrega?: string
  transportadora?: string
  peso?: string
  nr_viaturas?: string
  nr_paletes?: string
  
  // Notes
  notas?: string
}

export function AddDeliveryDialog({
  onSuccess,
  armazens,
  transportadoras,
  onArmazensUpdate,
  onTransportadorasUpdate,
}: AddDeliveryDialogProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<DeliveryFormData>({})
  const [loadingPhc, setLoadingPhc] = useState(false)
  const [phcItems, setPhcItems] = useState<any[]>([])

  const supabase = createBrowserClient()

  // Fetch PHC data when FO number changes
  const fetchPhcDataForFo = async (foNumber: string) => {
    if (!foNumber.trim()) {
      setPhcItems([])
      return
    }

    setLoadingPhc(true)
    try {
      console.log('🔍 Fetching PHC data for FO:', foNumber.trim())
      
      // 1. Query folha_obra_with_orcamento to get FO details
      const { data: phcFoData, error: phcFoError } = await supabase
        .schema('phc')
        .from('folha_obra_with_orcamento')
        .select('orcamento_number, customer_id, nome_trabalho, folha_obra_delivery_date, document_id')
        .eq('folha_obra_number', foNumber.trim())
        .limit(1)
        .maybeSingle()

      if (phcFoError) {
        console.error('Error fetching FO from PHC:', phcFoError)
        return
      }

      if (!phcFoData) {
        console.log('⚠️ FO not found in PHC')
        return
      }

      console.log('✅ Found FO in PHC:', phcFoData)

      // 2. Resolve customer name
      let clientName = ''
      if (phcFoData.customer_id) {
        const { data: clientData } = await supabase
          .from('clientes')
          .select('id, nome_cl')
          .eq('customer_id', phcFoData.customer_id)
          .maybeSingle()
        
        if (clientData) {
          clientName = clientData.nome_cl
        }
      }

      // 3. Query bi table to get items for this FO
      const { data: biLines, error: biError } = await supabase
        .schema('phc')
        .from('bi')
        .select('line_id, document_id, description, quantity, item_reference')
        .eq('document_id', phcFoData.document_id)
        .gt('quantity', 0)

      if (biError) {
        console.error('Error fetching BI lines:', biError)
        return
      }

      console.log(`✅ Found ${biLines?.length || 0} items in PHC BI`)

      // 4. Auto-fill form with PHC data
      setFormData((prev) => ({
        ...prev,
        numero_orc: phcFoData.orcamento_number || undefined,
        cliente: clientName || prev.cliente,
        nome_campanha: phcFoData.nome_trabalho || prev.nome_campanha,
      }))

      // 5. Store items for selection
      setPhcItems(biLines || [])

    } catch (error) {
      console.error('Error in fetchPhcDataForFo:', error)
    } finally {
      setLoadingPhc(false)
    }
  }

  const handleSave = async () => {
    // Validate required fields
    if (!formData.descricao?.trim()) {
      alert('Por favor, preencha a descrição do item.')
      return
    }

    setSaving(true)
    try {
      // Get the text labels for armazens
      const localRecolha = armazens.find((a) => a.value === formData.id_local_recolha)?.label || null
      const localEntrega = armazens.find((a) => a.value === formData.id_local_entrega)?.label || null

      // Format date for database (YYYY-MM-DD)
      const dataSaidaStr = formData.data_saida
        ? `${formData.data_saida.getFullYear()}-${String(formData.data_saida.getMonth() + 1).padStart(2, '0')}-${String(formData.data_saida.getDate()).padStart(2, '0')}`
        : null

      const { error } = await supabase.from('logistica_entregas').insert({
        // Item info (standalone, no item_id)
        descricao: formData.descricao.trim(),
        quantidade: formData.quantidade || null,
        brindes: formData.brindes || false,
        
        // Optional FO/ORC
        numero_fo: formData.numero_fo?.trim() || null,
        numero_orc: formData.numero_orc || null,
        
        // Client
        cliente: formData.cliente?.trim() || null,
        
        // Campaign
        nome_campanha: formData.nome_campanha?.trim() || null,
        
        // Logistics
        guia: formData.guia?.trim() || null,
        data_saida: dataSaidaStr,
        
        // Transport
        id_local_recolha: formData.id_local_recolha || null,
        local_recolha: localRecolha,
        id_local_entrega: formData.id_local_entrega || null,
        local_entrega: localEntrega,
        transportadora: formData.transportadora || null,
        peso: formData.peso?.trim() || null,
        nr_viaturas: formData.nr_viaturas?.trim() || null,
        nr_paletes: formData.nr_paletes?.trim() || null,
        
        // Notes
        notas: formData.notas?.trim() || null,
        
        // Default values
        saiu: false,
        concluido: false,
        is_entrega: true,
      })

      if (error) throw error

      // Reset form and close dialog
      setFormData({})
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error creating delivery:', error)
      alert('Erro ao criar entrega. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="bg-yellow-400 hover:bg-yellow-500 border border-black text-black"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Entrega</DialogTitle>
          <DialogDescription>
            Adicione uma nova entrega. FO e ORC são opcionais.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* FO/ORC Section (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_fo">FO (Opcional)</Label>
              <Input
                id="numero_fo"
                placeholder="Número FO"
                value={formData.numero_fo || ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, numero_fo: e.target.value }))
                }
                onBlur={(e) => {
                  // Fetch PHC data when user finishes typing FO number
                  if (e.target.value.trim()) {
                    fetchPhcDataForFo(e.target.value.trim())
                  }
                }}
                disabled={loadingPhc}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_orc">ORC (Opcional)</Label>
              <Input
                id="numero_orc"
                type="number"
                placeholder="Número ORC"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={formData.numero_orc || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    numero_orc: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          </div>

          {/* PHC Items Section - Show if items were found */}
          {phcItems.length > 0 && (
            <div className="space-y-2 border-l-4 border-primary pl-4 bg-muted/30 py-3 rounded">
              <Label className="text-sm font-semibold">
                ✅ {phcItems.length} item(s) encontrado(s) no PHC:
              </Label>
              <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                {phcItems.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        descricao: item.description,
                        quantidade: Math.round(Number(item.quantity)),
                      }))
                    }}
                    className="w-full flex justify-between gap-2 py-2 px-2 border-b hover:bg-accent rounded cursor-pointer transition-colors text-left"
                  >
                    <span className="flex-1 truncate">{item.description}</span>
                    <span className="text-muted-foreground">Qt: {Math.round(Number(item.quantity))}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Clique num item para preencher automaticamente
              </p>
            </div>
          )}

          {/* Cliente */}
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            <Input
              id="cliente"
              placeholder="Nome do Cliente"
              value={formData.cliente || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, cliente: e.target.value }))
              }
            />
          </div>

          {/* Campaign */}
          <div className="space-y-2">
            <Label htmlFor="nome_campanha">Nome da Campanha</Label>
            <Input
              id="nome_campanha"
              placeholder="Nome da Campanha"
              value={formData.nome_campanha || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nome_campanha: e.target.value }))
              }
            />
          </div>

          {/* Item Description (Required) and Brindes */}
          <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="descricao">
                Descrição do Item <span className="text-destructive">*</span>
              </Label>
              <Input
                id="descricao"
                placeholder="Descrição do item"
                value={formData.descricao || ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, descricao: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center space-x-2 pb-2">
              <Checkbox
                id="brindes"
                checked={!!formData.brindes}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    brindes: checked === 'indeterminate' ? false : checked,
                  }))
                }
              />
              <Label htmlFor="brindes" className="cursor-pointer">
                Brindes
              </Label>
            </div>
          </div>

          {/* Quantity, Guia, and Data Saída in one row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                placeholder="Quantidade"
                maxLength={6}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={formData.quantidade || ''}
                onChange={(e) => {
                  const value = e.target.value
                  if (value.length <= 6) {
                    setFormData((prev) => ({
                      ...prev,
                      quantidade: value ? Number(value) : undefined,
                    }))
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guia">Guia</Label>
              <Input
                id="guia"
                placeholder="Guia"
                maxLength={6}
                value={formData.guia || ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, guia: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Saída</Label>
              <DatePicker
                value={formData.data_saida || undefined}
                onChange={(date) =>
                  setFormData((prev) => ({ ...prev, data_saida: date || null }))
                }
              />
            </div>
          </div>

          {/* Transport Section */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold">Informações de Transporte</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Local de Recolha</Label>
                <CreatableArmazemCombobox
                  value={formData.id_local_recolha || ''}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, id_local_recolha: value }))
                  }
                  options={armazens}
                  placeholder="ARMAZÉM"
                  onOptionsUpdate={(newOptions) => {
                    // This will be handled by the parent's onArmazensUpdate callback
                    onArmazensUpdate?.()
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Local de Entrega</Label>
                <CreatableArmazemCombobox
                  value={formData.id_local_entrega || ''}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, id_local_entrega: value }))
                  }
                  options={armazens}
                  placeholder="ARMAZÉM"
                  onOptionsUpdate={(newOptions) => {
                    // This will be handled by the parent's onArmazensUpdate callback
                    onArmazensUpdate?.()
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Transportadora</Label>
              <CreatableTransportadoraCombobox
                value={formData.transportadora || ''}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, transportadora: value }))
                }
                options={transportadoras}
                placeholder="TRANSPORTADORA"
                onOptionsUpdate={(newOptions) => {
                  // This will be handled by the parent's onTransportadorasUpdate callback
                  onTransportadorasUpdate?.()
                }}
              />
            </div>

            {/* Transport Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peso">Peso</Label>
                <Input
                  id="peso"
                  placeholder="Peso"
                  maxLength={6}
                  value={formData.peso || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.length <= 6) {
                      setFormData((prev) => ({ ...prev, peso: value }))
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr_viaturas">Nº Viaturas</Label>
                <Input
                  id="nr_viaturas"
                  placeholder="Nº"
                  maxLength={3}
                  value={formData.nr_viaturas || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.length <= 3) {
                      setFormData((prev) => ({ ...prev, nr_viaturas: value }))
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nr_paletes">Nº Paletes</Label>
                <Input
                  id="nr_paletes"
                  placeholder="Nº"
                  maxLength={4}
                  value={formData.nr_paletes || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.length <= 4) {
                      setFormData((prev) => ({ ...prev, nr_paletes: value }))
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Notas adicionais"
              value={formData.notas || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notas: e.target.value }))
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'A guardar...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

