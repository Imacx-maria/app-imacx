"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MaterialConsumptionCard } from "./MaterialConsumptionCard";
import type { ItemSummaryCardProps } from "./types";

export function ItemSummaryCard({
  item,
  materialSummary,
  progressImpressao,
  progressCorte,
}: ItemSummaryCardProps) {
  return (
    <Card className="imx-border p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          {item.codigo} - {item.descricao}
        </h3>
        <p className="text-sm text-muted-foreground">
          FO: {item.fo_numero} | Quantidade: {item.quantidade_total}
        </p>
        {item.notas && (
          <p className="text-sm text-muted-foreground mt-1">{item.notas}</p>
        )}
      </div>

      <MaterialConsumptionCard materialSummary={materialSummary} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Impressão</span>
            <span>{progressImpressao.toFixed(1)}%</span>
          </div>
          <Progress value={progressImpressao} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Corte</span>
            <span>{progressCorte.toFixed(1)}%</span>
          </div>
          <Progress value={progressCorte} className="h-2" />
        </div>
      </div>
    </Card>
  );
}
