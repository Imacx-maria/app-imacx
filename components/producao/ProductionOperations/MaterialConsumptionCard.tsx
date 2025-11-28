"use client";

import { Card } from "@/components/ui/card";
import type { MaterialConsumptionCardProps } from "./types";

export function MaterialConsumptionCard({ materialSummary }: MaterialConsumptionCardProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="imx-border p-4">
        <h4 className="text-xs uppercase text-muted-foreground mb-2">
          Material Impresso
        </h4>
        <p className="text-2xl font-bold">
          {materialSummary.material_impresso_total}
        </p>
        <p className="text-xs text-muted-foreground">placas</p>
        {materialSummary.detalhe_por_material?.impresso?.length > 0 && (
          <div className="mt-2 space-y-1">
            {materialSummary.detalhe_por_material.impresso.map((detail, idx) => (
              <div key={idx} className="text-xs text-muted-foreground">
                {detail.tipo} {detail.espessura}: {detail.quantidade}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="imx-border p-4">
        <h4 className="text-xs uppercase text-muted-foreground mb-2">
          Material Não Impresso
        </h4>
        <p className="text-2xl font-bold">
          {materialSummary.material_nao_impresso_total}
        </p>
        <p className="text-xs text-muted-foreground">placas</p>
        {materialSummary.detalhe_por_material?.nao_impresso?.length > 0 && (
          <div className="mt-2 space-y-1">
            {materialSummary.detalhe_por_material.nao_impresso.map((detail, idx) => (
              <div key={idx} className="text-xs text-muted-foreground">
                {detail.tipo} {detail.espessura}: {detail.quantidade}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
