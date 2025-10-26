import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose, DrawerDescription } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { X, Save, Clock, User, Cog, AlertTriangle } from 'lucide-react'
import DatePicker from '@/components/ui/DatePicker'
import { createBrowserClient } from '@/utils/supabase'
import { FOItemSelector } from './FOItemSelector'
import { MaterialSelector } from './MaterialSelector'
import type { 
  ProductionOperationWithRelations, 
  ProductionOperationInput, 
  Profile, 
  Machine
} from '@/types/producao'
import { OPERATION_TYPES } from '@/types/producao'

interface OperationFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  operation?: ProductionOperationWithRelations | null
  onSubmit: (operationData: ProductionOperationInput) => Promise<void>
  loading?: boolean
}

export const OperationForm: React.FC<OperationFormProps> = ({
  open,
  onOpenChange,
  operation,
  onSubmit,
  loading = false
}) => {
  const [formData, setFormData] = useState<ProductionOperationInput>({
    folha_obra_id: '',
    item_id: '',
    operador_id: '',
    data_operacao: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: '',
    hora_fim: '',
    tipo_operacao: '',
    no_interno: '',
    maquina_impressao_id: '',
    maquina_corte_id: '',
    material_id: '',
    quantidade_material_usado: 0,
    desperdicio: 0,
    qualidade: '',
    observacoes: ''
  })

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const supabase = createBrowserClient()

  // Load form data when operation changes
  useEffect(() => {
    if (operation) {
      setFormData({
        folha_obra_id: operation.folha_obra_id,
        item_id: operation.item_id,
        operador_id: operation.operador_id || '',
        data_operacao: operation.data_operacao,
        hora_inicio: operation.hora_inicio || '',
        hora_fim: operation.hora_fim || '',
        tipo_operacao: operation.tipo_operacao,
        no_interno: operation.no_interno,
        maquina_impressao_id: operation.maquina_impressao_id || '',
        maquina_corte_id: operation.maquina_corte_id || '',
        material_id: operation.material_id,
        quantidade_material_usado: operation.quantidade_material_usado,
        desperdicio: operation.desperdicio || 0,
        qualidade: operation.qualidade || '',
        observacoes: operation.observacoes || ''
      })
    } else {
      // Reset form for new operation
      setFormData({
        folha_obra_id: '',
        item_id: '',
        operador_id: '',
        data_operacao: format(new Date(), 'yyyy-MM-dd'),
        hora_inicio: format(new Date(), 'HH:mm'),
        hora_fim: '',
        tipo_operacao: '',
        no_interno: '',
        maquina_impressao_id: '',
        maquina_corte_id: '',
        material_id: '',
        quantidade_material_usado: 0,
        desperdicio: 0,
        qualidade: '',
        observacoes: ''
      })
    }
  }, [operation])

  // Load profiles and machines
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('first_name', { ascending: true })

        if (profilesError) {
          console.error('Error loading profiles:', profilesError)
        } else if (profilesData) {
          setProfiles(profilesData)
        }

        // Load machines
        const { data: machinesData, error: machinesError } = await supabase
          .from('maquinas_operacao')
          .select('*')
          .eq('ativa', true)
          .order('nome_maquina', { ascending: true })

        if (machinesError) {
          console.error('Error loading machines:', machinesError)
        } else if (machinesData) {
          setMachines(machinesData)
        }
      } catch (err) {
        console.error('Error loading form data:', err)
      }
    }

    if (open) {
      loadData()
    }
  }, [open, supabase])

  // Auto-generate internal number
  useEffect(() => {
    if (!formData.no_interno && formData.data_operacao && formData.folha_obra_id) {
      const dateStr = formData.data_operacao.replace(/-/g, '')
      const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '')
      const foShort = formData.folha_obra_id.slice(-4)
      setFormData(prev => ({
        ...prev,
        no_interno: `OP${dateStr}${timeStr}${foShort}`
      }))
    }
  }, [formData.data_operacao, formData.folha_obra_id, formData.no_interno])

  // Handle input changes
  const handleInputChange = (field: keyof ProductionOperationInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.folha_obra_id) newErrors.folha_obra_id = 'Folha de obra é obrigatória'
    if (!formData.item_id) newErrors.item_id = 'Item é obrigatório'
    if (!formData.tipo_operacao) newErrors.tipo_operacao = 'Tipo de operação é obrigatório'
    if (!formData.no_interno) newErrors.no_interno = 'Número interno é obrigatório'
    if (!formData.material_id) newErrors.material_id = 'Material é obrigatório'
    if (!formData.quantidade_material_usado || formData.quantidade_material_usado <= 0) {
      newErrors.quantidade_material_usado = 'Quantidade deve ser maior que zero'
    }

    // Validate machine selection based on operation type
    if (formData.tipo_operacao === 'Impressão' && !formData.maquina_impressao_id) {
      newErrors.maquina_impressao_id = 'Máquina de impressão é obrigatória'
    }
    if (formData.tipo_operacao === 'Corte' && !formData.maquina_corte_id) {
      newErrors.maquina_corte_id = 'Máquina de corte é obrigatória'
    }
    if (formData.tipo_operacao === 'Impressão+Corte') {
      if (!formData.maquina_impressao_id) newErrors.maquina_impressao_id = 'Máquina de impressão é obrigatória'
      if (!formData.maquina_corte_id) newErrors.maquina_corte_id = 'Máquina de corte é obrigatória'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(formData)
      onOpenChange(false)
    } catch (err) {
      console.error('Error submitting operation:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Get filtered machines by type
  const getFilteredMachines = (type: string) => {
    return machines.filter(machine => machine.tipo.toLowerCase().includes(type.toLowerCase()))
  }

  // Show/hide machine selectors based on operation type
  const showPrintMachine = formData.tipo_operacao === 'Impressão' || formData.tipo_operacao === 'Impressão+Corte'
  const showCutMachine = formData.tipo_operacao === 'Corte' || formData.tipo_operacao === 'Impressão+Corte'

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <DrawerContent className="h-screen min-h-screen !top-0 !mt-0 max-w-[95vw] mx-auto">
        <div className="w-full px-4 md:px-8 flex flex-col h-full">
          <DrawerHeader className="flex-none">
            <div className="flex justify-end items-center gap-2 mb-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      form="operation-form"
                      variant="default"
                      size="sm"
                      disabled={submitting}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {operation ? 'Atualizar' : 'Criar'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {operation ? 'Atualizar operação' : 'Criar nova operação'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <DrawerClose asChild>
                <Button variant="outline" size="sm">
                  <X className="w-5 h-5" />
                </Button>
              </DrawerClose>
            </div>
            <DrawerTitle className="text-xl font-bold">
              {operation ? 'Editar Operação' : 'Nova Operação de Produção'}
            </DrawerTitle>
            <DrawerDescription>
              {operation ? 
                `Editando operação ${operation.no_interno}` : 
                'Criar uma nova operação de produção e consumir material automaticamente'
              }
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-grow overflow-y-auto">
            <form id="operation-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informações Básicas</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="data_operacao">Data da Operação</Label>
                    <DatePicker
                      selected={formData.data_operacao ? new Date(formData.data_operacao) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          handleInputChange('data_operacao', format(date, 'yyyy-MM-dd'))
                        }
                      }}
                      buttonClassName="w-full"
                    />
                  </div>

                  <div>
                    <Label htmlFor="no_interno">Número Interno</Label>
                    <Input
                      id="no_interno"
                      value={formData.no_interno}
                      onChange={(e) => handleInputChange('no_interno', e.target.value)}
                      className={errors.no_interno ? 'border-red-500' : ''}
                    />
                    {errors.no_interno && (
                      <p className="text-sm text-red-500 mt-1">{errors.no_interno}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hora_inicio">Hora de Início</Label>
                    <Input
                      id="hora_inicio"
                      type="time"
                      value={formData.hora_inicio}
                      onChange={(e) => handleInputChange('hora_inicio', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="hora_fim">Hora de Fim (opcional)</Label>
                    <Input
                      id="hora_fim"
                      type="time"
                      value={formData.hora_fim}
                      onChange={(e) => handleInputChange('hora_fim', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="operador_id">Operador</Label>
                  <Select value={formData.operador_id} onValueChange={(value) => handleInputChange('operador_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar operador" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.first_name} {profile.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Work Order and Item Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Folha de Obra e Item</h3>
                <FOItemSelector
                  folhaObraId={formData.folha_obra_id}
                  itemId={formData.item_id}
                  onFolhaObraChange={(value) => handleInputChange('folha_obra_id', value)}
                  onItemChange={(value) => handleInputChange('item_id', value)}
                />
                {errors.folha_obra_id && (
                  <p className="text-sm text-red-500">{errors.folha_obra_id}</p>
                )}
                {errors.item_id && (
                  <p className="text-sm text-red-500">{errors.item_id}</p>
                )}
              </div>

              {/* Operation Type and Machines */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Tipo de Operação e Máquinas</h3>
                
                <div>
                  <Label htmlFor="tipo_operacao">Tipo de Operação</Label>
                  <Select value={formData.tipo_operacao} onValueChange={(value) => handleInputChange('tipo_operacao', value)}>
                    <SelectTrigger className={errors.tipo_operacao ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Selecionar tipo de operação" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(OPERATION_TYPES).map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tipo_operacao && (
                    <p className="text-sm text-red-500 mt-1">{errors.tipo_operacao}</p>
                  )}
                </div>

                {showPrintMachine && (
                  <div>
                    <Label htmlFor="maquina_impressao">Máquina de Impressão</Label>
                    <Select 
                      value={formData.maquina_impressao_id} 
                      onValueChange={(value) => handleInputChange('maquina_impressao_id', value)}
                    >
                      <SelectTrigger className={errors.maquina_impressao_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Selecionar máquina de impressão" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredMachines('impressão').map(machine => (
                          <SelectItem key={machine.id} value={machine.id}>
                            {machine.nome_maquina}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.maquina_impressao_id && (
                      <p className="text-sm text-red-500 mt-1">{errors.maquina_impressao_id}</p>
                    )}
                  </div>
                )}

                {showCutMachine && (
                  <div>
                    <Label htmlFor="maquina_corte">Máquina de Corte</Label>
                    <Select 
                      value={formData.maquina_corte_id} 
                      onValueChange={(value) => handleInputChange('maquina_corte_id', value)}
                    >
                      <SelectTrigger className={errors.maquina_corte_id ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Selecionar máquina de corte" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredMachines('corte').map(machine => (
                          <SelectItem key={machine.id} value={machine.id}>
                            {machine.nome_maquina}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.maquina_corte_id && (
                      <p className="text-sm text-red-500 mt-1">{errors.maquina_corte_id}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Material and Consumption */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Material e Consumo</h3>
                
                <div>
                  <Label htmlFor="material">Material</Label>
                  <MaterialSelector
                    value={formData.material_id}
                    onChange={(value) => handleInputChange('material_id', value)}
                    requiredQuantity={formData.quantidade_material_usado}
                    showStockInfo={true}
                    className="mt-1"
                  />
                  {errors.material_id && (
                    <p className="text-sm text-red-500 mt-1">{errors.material_id}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantidade_material_usado">Quantidade Usada</Label>
                    <Input
                      id="quantidade_material_usado"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.quantidade_material_usado}
                      onChange={(e) => handleInputChange('quantidade_material_usado', parseFloat(e.target.value) || 0)}
                      className={errors.quantidade_material_usado ? 'border-red-500' : ''}
                    />
                    {errors.quantidade_material_usado && (
                      <p className="text-sm text-red-500 mt-1">{errors.quantidade_material_usado}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="desperdicio">Desperdício (opcional)</Label>
                    <Input
                      id="desperdicio"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.desperdicio}
                      onChange={(e) => handleInputChange('desperdicio', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Quality and Notes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Qualidade e Observações</h3>
                
                <div>
                  <Label htmlFor="qualidade">Avaliação de Qualidade</Label>
                  <Select value={formData.qualidade} onValueChange={(value) => handleInputChange('qualidade', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar qualidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Excelente">Excelente</SelectItem>
                      <SelectItem value="Boa">Boa</SelectItem>
                      <SelectItem value="Aceitável">Aceitável</SelectItem>
                      <SelectItem value="Com problemas">Com problemas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => handleInputChange('observacoes', e.target.value)}
                    placeholder="Observações sobre a operação..."
                    className="min-h-[80px] h-24 resize-none"
                  />
                </div>
              </div>
            </form>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
} 