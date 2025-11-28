"use client"

import { Button } from "@/components/ui/button"
import { FilterInput } from "@/components/custom/FilterInput"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BarChart3, RotateCw, XSquare } from "lucide-react"
import Link from "next/link"
import { DesignerFlowHelpDialog } from "@/components/designer/DesignerFlowHelpDialog"

interface DesignerFlowFiltersProps {
  foFilter: string
  orcFilter: string
  campaignFilter: string
  itemFilter: string
  codigoFilter: string
  loading: boolean
  onFoChange: (value: string) => void
  onOrcChange: (value: string) => void
  onCampaignChange: (value: string) => void
  onItemChange: (value: string) => void
  onCodigoChange: (value: string) => void
  onClearFilters: () => void
  onRefresh: () => void
}

export const DesignerFlowFilters = ({
  foFilter,
  orcFilter,
  campaignFilter,
  itemFilter,
  codigoFilter,
  loading,
  onFoChange,
  onOrcChange,
  onCampaignChange,
  onItemChange,
  onCodigoChange,
  onClearFilters,
  onRefresh,
}: DesignerFlowFiltersProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl">FLUXO DO DESIGNER</h1>
          <p className="text-xs text-muted-foreground mt-1">
            GESTÃO DE PROPOSTAS, APROVAÇÕES, PAGINAÇÃO E PLANOS DE PRODUÇÃO POR FOLHA DE OBRA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/designer-flow/analytics">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              ANÁLISE
            </Button>
          </Link>
          <DesignerFlowHelpDialog />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <FilterInput
            value={foFilter}
            onChange={onFoChange}
            onFilterChange={() => {}}
            placeholder="FO"
            minChars={3}
            debounceMs={300}
            disabled={loading}
            className="h-10 w-[110px] rounded-none"
          />
          <FilterInput
            value={orcFilter}
            onChange={onOrcChange}
            onFilterChange={() => {}}
            placeholder="ORC"
            minChars={3}
            debounceMs={300}
            disabled={loading}
            className="h-10 w-[110px] rounded-none"
          />
          <FilterInput
            value={campaignFilter}
            onChange={onCampaignChange}
            onFilterChange={() => {}}
            placeholder="Campanha"
            minChars={3}
            debounceMs={300}
            disabled={loading}
            className="h-10 flex-1 rounded-none"
          />
          <FilterInput
            value={itemFilter}
            onChange={onItemChange}
            onFilterChange={() => {}}
            placeholder="Item"
            minChars={3}
            debounceMs={300}
            disabled={loading}
            className="h-10 flex-1 rounded-none"
          />
          <FilterInput
            value={codigoFilter}
            onChange={onCodigoChange}
            onFilterChange={() => {}}
            placeholder="Código"
            minChars={3}
            debounceMs={300}
            disabled={loading}
            className="h-10 flex-1 rounded-none"
          />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  onClick={onClearFilters}
                  disabled={!foFilter && !orcFilter && !campaignFilter && !itemFilter && !codigoFilter}
                >
                  <XSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpar Filtros</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={onRefresh}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
