"use client";

import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ExecutionsTableProps } from "./types";

export function ExecutionsTable({ executions, showMaterial }: ExecutionsTableProps) {
  if (executions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Nenhuma execução registada
      </div>
    );
  }

  return (
    <div className="imx-table-wrap">
      <Table className="imx-table-compact">
        <TableHeader>
          <TableRow>
            <TableHead className="imx-border-b uppercase w-[140px]">Data/Hora</TableHead>
            <TableHead className="imx-border-b uppercase">Operador</TableHead>
            <TableHead className="imx-border-b uppercase w-[100px]">Máquina</TableHead>
            <TableHead className="imx-border-b uppercase text-right w-[80px]">Qtd</TableHead>
            {showMaterial && (
              <TableHead className="imx-border-b uppercase">Material</TableHead>
            )}
            <TableHead className="imx-border-b uppercase">Notas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map((exec) => (
            <TableRow key={exec.id}>
              <TableCell>
                {format(new Date(exec.data_hora), "dd/MM/yyyy HH:mm", { locale: pt })}
              </TableCell>
              <TableCell>{exec.operador_nome || "-"}</TableCell>
              <TableCell>{exec.maquina}</TableCell>
              <TableCell className="text-right font-medium">
                {exec.quantidade_executada}
              </TableCell>
              {showMaterial && (
                <TableCell>
                  {exec.material ? (
                    <div className="flex items-center gap-2">
                      <span>{exec.material.tipo}</span>
                      {exec.material.espessura && (
                        <span className="text-muted-foreground">
                          {exec.material.espessura}
                        </span>
                      )}
                      {exec.material.is_palette && (
                        <Badge variant="outline" className="text-xs">Palete</Badge>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
              )}
              <TableCell className="text-muted-foreground">
                {exec.notas || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
