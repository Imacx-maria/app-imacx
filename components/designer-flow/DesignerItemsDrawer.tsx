"use client"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import DesignerItemCard from "@/components/DesignerItemCard"
import type {
  Item,
  Job,
  UpdateItemParams,
} from "@/app/designer-flow/types"
import type { ReactElement } from "react"

type ComplexidadeOption = {
  value: string
  label: string
}

type ComplexidadeComponentProps = {
  value: string
  onChange: (value: string) => void
  options: ComplexidadeOption[]
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  className?: string
}

interface DesignerItemsDrawerProps {
  selectedJob: Job | null
  jobItems: Item[]
  itemPlanos: Record<string, any[]>
  ComplexidadeCombobox: (props: ComplexidadeComponentProps) => ReactElement
  complexidades: ComplexidadeOption[]
  isLoadingComplexidades: boolean
  openItemId: string | null
  onToggleItem: (itemId: string | null) => void
  onPlanosChange: (itemId: string) => (planos: any[]) => void
  onUpdate: (params: UpdateItemParams) => Promise<void>
  onDescricaoChange: (itemId: string, value: string) => Promise<void>
  onCodigoChange: (itemId: string, value: string) => Promise<void>
  onComplexidadeChange: (itemId: string, grau: string | null) => Promise<void>
  onOpenPathDialog: (jobId: string, item: Item, index: number) => void
  onClose: () => void
  isOpen: boolean
}

const DesignerItemsDrawer = ({
  selectedJob,
  jobItems,
  itemPlanos,
  ComplexidadeCombobox,
  complexidades,
  isLoadingComplexidades,
  openItemId,
  onToggleItem,
  onPlanosChange,
  onUpdate,
  onDescricaoChange,
  onCodigoChange,
  onComplexidadeChange,
  onOpenPathDialog,
  onClose,
  isOpen,
}: DesignerItemsDrawerProps) => {
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="flex max-h-[85vh] flex-col">
        <DrawerHeader className="flex-shrink-0">
          <DrawerTitle>
            Design Items - FO {selectedJob?.numero_fo} / ORC {selectedJob?.numero_orc}
          </DrawerTitle>
          <DrawerDescription>{selectedJob?.nome_campanha}</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6" style={{ minHeight: 0 }}>
          {jobItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Carregando itens...</div>
          ) : (
            jobItems.map((item, index) => (
              <DesignerItemCard
                key={item.designer_item_id || `item-${index}`}
                item={item}
                jobId={selectedJob!.id}
                jobDataIn={selectedJob?.data_in ?? null}
                index={index}
                onUpdate={onUpdate}
                onDescricaoChange={onDescricaoChange}
                onCodigoChange={onCodigoChange}
                onOpenPathDialog={onOpenPathDialog}
                ComplexidadeCombobox={ComplexidadeCombobox}
                complexidades={complexidades}
                isLoadingComplexidades={isLoadingComplexidades}
                onComplexidadeChange={onComplexidadeChange}
                isOpen={openItemId === item.designer_item_id}
                onToggle={(open) => onToggleItem(open ? item.designer_item_id : null)}
                planos={itemPlanos[item.id] || []}
                onPlanosChange={onPlanosChange(item.id)}
              />
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export default DesignerItemsDrawer
