'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { RHEmployeeWithDepartment } from '@/types/ferias'
import { CONTRACT_TYPE_LABELS } from '@/types/ferias'
import {
  formatDateDisplay,
  formatVacationBalance,
  calculateRemainingDays,
  getVacationStatus,
} from '@/utils/ferias/vacationHelpers'

interface VacationBalanceCardProps {
  employee: RHEmployeeWithDepartment
}

export default function VacationBalanceCard({ employee }: VacationBalanceCardProps) {
  const remaining = useMemo(
    () =>
      calculateRemainingDays(
        employee.previous_year_balance,
        employee.current_year_total || 0,
        employee.current_year_used
      ),
    [employee]
  )

  const total = employee.previous_year_balance + (employee.current_year_total || 0)
  const usedPercentage = total > 0 ? (employee.current_year_used / total) * 100 : 0
  const status = getVacationStatus(remaining, total)

  const statusClasses = {
    critical: 'text-destructive',
    warning: 'text-warning',
    good: 'text-success',
  }

  return (
    <div className="space-y-4">
      {/* Employee Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Informacoes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sigla:</span>
            <span>{employee.sigla}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Departamento:</span>
            <span>{employee.departamento?.nome || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Contrato:</span>
            <span>{CONTRACT_TYPE_LABELS[employee.contract_type]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Admissao:</span>
            <span>{formatDateDisplay(employee.admission_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dias Anuais:</span>
            <span>{employee.annual_vacation_days}</span>
          </div>
        </CardContent>
      </Card>

      {/* Balance Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Saldo de Ferias {new Date().getFullYear()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Saldo Ano Anterior:</span>
              <span>{formatVacationBalance(employee.previous_year_balance)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Direito Ano Atual:</span>
              <span>{formatVacationBalance(employee.current_year_total || 0)}</span>
            </div>
            <div className="flex justify-between text-sm imx-border-t pt-2">
              <span className="text-muted-foreground">Total Disponivel:</span>
              <span>{formatVacationBalance(total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Dias Utilizados:</span>
              <span>{formatVacationBalance(employee.current_year_used)}</span>
            </div>
            <Progress value={usedPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round(usedPercentage)}% utilizado</span>
              <span>{Math.round(100 - usedPercentage)}% restante</span>
            </div>
          </div>

          <div className="imx-border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-lg">Dias Restantes:</span>
              <span className={`text-2xl ${statusClasses[status]}`}>
                {formatVacationBalance(remaining)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Alert */}
      {status === 'critical' && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Atencao: Poucos dias de ferias restantes. Considere planear as ferias em breve.
        </div>
      )}
      {status === 'warning' && (
        <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
          Nota: Restam poucos dias de ferias. Verifique o planeamento.
        </div>
      )}
    </div>
  )
}
