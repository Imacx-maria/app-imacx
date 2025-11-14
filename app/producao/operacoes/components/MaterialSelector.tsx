import React, { useState, useEffect, useMemo } from 'react'
import { Check, ChevronsUpDown, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { createBrowserClient } from '@/utils/supabase'
import { useStockValidation, type StockInfo } from '../hooks/useStockValidation'

interface Material {
  id: string
  material?: string | null
  cor?: string | null
  tipo?: string | null
  carateristica?: string | null
  valor_m2?: number | null
}

interface MaterialOption extends Material {
  displayName: string
  stockInfo?: StockInfo
}

interface MaterialSelectorProps {
  value?: string
  onChange: (materialId: string) => void
  requiredQuantity?: number
  showStockInfo?: boolean
  disabled?: boolean
  className?: string
}

export const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  value,
  onChange,
  requiredQuantity = 0,
  showStockInfo = true,
  disabled = false,
  className
}) => {
  const [open, setOpen] = useState(false)
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchValue, setSearchValue] = useState('')

  const { getStockInfo } = useStockValidation()
  const supabase = createBrowserClient()

  // Fetch materials
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('materiais')
          .select('*')
          .order('material', { ascending: true })

        if (error) {
          console.error('Error fetching materials:', error)
          return
        }

        if (data) {
          const materialsWithDisplay = await Promise.all(
            data.map(async (material) => {
              const displayName = [
                material.material,
                material.cor,
                material.tipo,
                material.carateristica
              ].filter(Boolean).join(' - ')

              let stockInfo: StockInfo | undefined
              if (showStockInfo && material.id) {
                stockInfo = await getStockInfo(material.id) || undefined
              }

              return {
                ...material,
                displayName,
                stockInfo
              }
            })
          )

          setMaterials(materialsWithDisplay)
        }
      } catch (err) {
        console.error('Error loading materials:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMaterials()
  }, [supabase, getStockInfo, showStockInfo])

  // Filter materials based on search
  const filteredMaterials = useMemo(() => {
    if (!searchValue) return materials

    return materials.filter(material =>
      material.displayName.toLowerCase().includes(searchValue.toLowerCase()) ||
      material.material?.toLowerCase().includes(searchValue.toLowerCase()) ||
      material.cor?.toLowerCase().includes(searchValue.toLowerCase()) ||
      material.tipo?.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [materials, searchValue])

  // Get selected material
  const selectedMaterial = materials.find(m => m.id === value)

  // Get stock status for a material
  const getStockStatus = (material: MaterialOption) => {
    if (!material.stockInfo) return null

    if (material.stockInfo.isOutOfStock) {
      return {
        icon: XCircle,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        label: 'Sem estoque',
        available: 0
      }
    }

    if (material.stockInfo.isLowStock) {
      return {
        icon: AlertTriangle,
        color: 'text-warning',
        bgColor: 'bg-warning/15',
        label: 'Estoque baixo',
        available: material.stockInfo.availableQuantity
      }
    }

    if (requiredQuantity > 0 && material.stockInfo.availableQuantity < requiredQuantity) {
      return {
        icon: AlertTriangle,
        color: 'text-warning',
        bgColor: 'bg-warning/15',
        label: 'Insuficiente',
        available: material.stockInfo.availableQuantity
      }
    }

    return {
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/15',
      label: 'Disponível',
      available: material.stockInfo.availableQuantity
    }
  }

  // Format price
  const formatPrice = (price?: number | null) => {
    if (!price) return null
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(price)
  }

  // Handle material selection
  const handleSelect = (materialId: string) => {
    onChange(materialId)
    setOpen(false)
    setSearchValue('')
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedMaterial ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="truncate">{selectedMaterial.displayName}</span>
                {showStockInfo && selectedMaterial.stockInfo && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(() => {
                      const status = getStockStatus(selectedMaterial)
                      if (!status) return null
                      const Icon = status.icon
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Icon className={`w-4 h-4 ${status.color}`} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div>{status.label}</div>
                                <div>Disponível: {status.available} {selectedMaterial.stockInfo?.unit}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })()}
                  </div>
                )}
              </div>
            ) : (
              "Selecionar material..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput 
              placeholder="Pesquisar material..." 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandEmpty>
              {loading ? "Carregando..." : "Nenhum material encontrado."}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredMaterials.map((material) => {
                const status = getStockStatus(material)
                
                return (
                  <CommandItem
                    key={material.id}
                    value={material.id}
                    onSelect={() => handleSelect(material.id)}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <Check
                        className={
                          value === material.id ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {material.displayName}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {material.valor_m2 && (
                            <span>{formatPrice(material.valor_m2)}/m²</span>
                          )}
                          {status && (
                            <div className="flex items-center gap-1">
                              <span>{status.available} {material.stockInfo?.unit}</span>
                              <Badge 
                                className={`text-xs ${status.bgColor} ${status.color}`}
                              >
                                {status.label}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {status && (
                      <div className="flex-shrink-0 ml-2">
                        <status.icon className={`w-4 h-4 ${status.color}`} />
                      </div>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Stock validation message */}
      {selectedMaterial && requiredQuantity > 0 && selectedMaterial.stockInfo && (
        <div className="mt-2">
          {(() => {
            const validation = selectedMaterial.stockInfo.availableQuantity >= requiredQuantity
            const remaining = selectedMaterial.stockInfo.availableQuantity - requiredQuantity

            if (!validation) {
              return (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 imx-border ">
                  <XCircle className="w-4 h-4" />
                  <span>
                    Estoque insuficiente. Disponível: {selectedMaterial.stockInfo.availableQuantity} {selectedMaterial.stockInfo.unit}
                  </span>
                </div>
              )
            }

            if (remaining <= 5) {
              return (
                <div className="flex items-center gap-2 text-sm text-warning bg-warning/15 p-2 imx-border ">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    Atenção: Restará apenas {remaining} {selectedMaterial.stockInfo.unit} após a operação
                  </span>
                </div>
              )
            }

            return (
              <div className="flex items-center gap-2 text-sm text-success bg-success/15 p-2 imx-border ">
                <CheckCircle className="w-4 h-4" />
                <span>
                  Material disponível. Restará {remaining} {selectedMaterial.stockInfo.unit} após a operação
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

