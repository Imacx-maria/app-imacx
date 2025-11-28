"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlansTableProps } from "./types";

export function PlansTable({
  plans,
  onSelectPlan,
  selectedPlanId,
  showMaterial,
  readOnly = false,
}: PlansTableProps) {
  const getStatusBadge = (plan: PlansTableProps["plans"][0]) => {
    const percentage = plan.quantidade_chapas > 0
      ? (plan.quantidade_executada / plan.quantidade_chapas) * 100
      : 0;

    if (percentage >= 100) {
      return <Badge variant="default" className="bg-success">Completo</Badge>;
    } else if (percentage > 0) {
      return <Badge variant="secondary">Em Progresso</Badge>;
    }
    return <Badge variant="outline">Pendente</Badge>;
  };

  if (plans.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Nenhum plano encontrado
      </div>
    );
  }

  return (
    <div className="imx-table-wrap">
      <Table className="imx-table-compact">
        <TableHeader>
          <TableRow>
            <TableHead className="imx-border-b uppercase w-[80px]">Plano</TableHead>
            <TableHead className="imx-border-b uppercase text-right w-[80px]">Chapas</TableHead>
            <TableHead className="imx-border-b uppercase text-right w-[80px]">Executado</TableHead>
            <TableHead className="imx-border-b uppercase text-right w-[80px]">Falta</TableHead>
            {showMaterial && (
              <TableHead className="imx-border-b uppercase">Material</TableHead>
            )}
            <TableHead className="imx-border-b uppercase w-[80px]">Origem</TableHead>
            <TableHead className="imx-border-b uppercase w-[100px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow
              key={plan.id}
              onClick={() => !readOnly && onSelectPlan(plan.id)}
              className={cn(
                !readOnly && "cursor-pointer imx-row-hover",
                selectedPlanId === plan.id && "bg-accent"
              )}
            >
              <TableCell className="font-medium">{plan.nome}</TableCell>
              <TableCell className="text-right">{plan.quantidade_chapas}</TableCell>
              <TableCell className="text-right">{plan.quantidade_executada}</TableCell>
              <TableCell className="text-right">{plan.quantidade_falta}</TableCell>
              {showMaterial && (
                <TableCell>{plan.material_tipo || "-"}</TableCell>
              )}
              <TableCell>
                <Badge variant={plan.origem === "designer" ? "default" : "outline"}>
                  {plan.origem}
                </Badge>
              </TableCell>
              <TableCell>{getStatusBadge(plan)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
