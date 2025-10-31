// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { RotateCw, Package, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { MATERIAL_COLORS, generateChartColors } from '@/lib/chart-colors'

// Types
interface OperationData {
  id: string
  data_operacao: string
  operador_id?: string | null
  num_placas_print?: number | null
  num_placas_corte?: number | null
  Tipo_Op?: string
  material_id?: string | null
  maquina?: string | null
  source_impressao_id?: string | null
  profiles?: {
    first_name?: string
    last_name?: string
    role_id?: string
  }
  materiais?: {
    material?: string
  } | null
}

interface MonthlyData {
  month: string
  total_print: number
  total_corte_impressao: number
  total_corte_chapas: number
}

interface OperatorMonthlyData {
  month: string
  [key: string]: string | number // Dynamic operator names as keys
}

interface MachineMonthlyData {
  month: string
  [key: string]: string | number // Dynamic machine names as keys
}

interface MaterialMonthlyData {
  month: string
  [key: string]: string | number // Dynamic material types as keys
}

interface ProductionAnalyticsChartsProps {
  supabase: any
  onRefresh?: () => Promise<void>
}

// Chart color palette using CSS variables from design system
// Colors are defined in globals.css and adapt to light/dark mode
const CHART_COLORS = {
  print: MATERIAL_COLORS.RIGIDOS(), // Muted teal blue - for regular print operations
  corte: MATERIAL_COLORS.CARTAO(), // Soft pastel yellow - for corte operations
  corteImpressao: MATERIAL_COLORS.FLEXIVEIS(), // Earthy green - for corte with source
  corteChapas: MATERIAL_COLORS.WARNING(), // Warm beige - for standalone corte
  neutral: MATERIAL_COLORS.WARNING(), // Warm beige - for neutral states
  warning: MATERIAL_COLORS.WARNING(), // Warm beige - for warnings
  critical: MATERIAL_COLORS.CRITICAL(), // Dark charcoal brown - for critical states
}

// Generate colors for different operators using theme-aware palette
const generateOperatorColors = (operatorCount: number) => {
  return generateChartColors(operatorCount)
}

export default function ProductionAnalyticsCharts({
  supabase,
  onRefresh,
}: ProductionAnalyticsChartsProps) {
  const [operations, setOperations] = useState<OperationData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch operations data for current year
  const fetchOperationsAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const currentYear = new Date().getFullYear()
      const startDate = `${currentYear}-01-01`
      const endDate = `${currentYear}-12-31`

      const { data, error } = await supabase
        .from('producao_operacoes')
        .select(
          `
          id,
          data_operacao,
          operador_id,
          num_placas_print,
          num_placas_corte,
          Tipo_Op,
          material_id,
          maquina,
          source_impressao_id,
          profiles!operador_id (
            first_name,
            last_name,
            role_id
          ),
          materiais!material_id (
            material
          )
        `,
        )
        .gte('data_operacao', startDate)
        .lte('data_operacao', endDate)
        .order('data_operacao', { ascending: true })

      if (error) {
        throw error
      }

      console.log(
        '🔍 Raw data fetched from database:',
        data?.length || 0,
        'operations',
      )
      if (data && data.length > 0) {
        // Show sample of operations with their types
        const sampleOps = data.slice(0, 5).map((op: any) => ({
          id: op.id,
          Tipo_Op: op.Tipo_Op,
          data_operacao: op.data_operacao,
          operador_id: op.operador_id,
          num_placas_print: op.num_placas_print,
          num_placas_corte: op.num_placas_corte,
        }))
        console.log('🔍 Sample operations from database:', sampleOps)

        // Check specifically for Impressao_Flexiveis operations
        const vinilOpsInData = data.filter(
          (op: any) => op.Tipo_Op === 'Impressao_Flexiveis',
        )
        console.log(
          '🎨 Impressao_Flexiveis operations in raw data:',
          vinilOpsInData.length,
        )
      }

      setOperations(data || [])
    } catch (err: any) {
      console.error('Error fetching operations analytics:', err)
      setError(err.message || 'Erro ao carregar dados de análise')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Refresh function that calls both local refresh and parent refresh
  const handleRefresh = useCallback(async () => {
    await fetchOperationsAnalytics()
    if (onRefresh) {
      await onRefresh()
    }
  }, [fetchOperationsAnalytics, onRefresh])

  useEffect(() => {
    fetchOperationsAnalytics()
  }, [fetchOperationsAnalytics])

  // Process data for monthly totals
  const monthlyTotals = useMemo(() => {
    const monthlyData: { [key: string]: MonthlyData } = {}

    operations.forEach((operation) => {
      if (!operation.data_operacao) return

      const date = new Date(operation.data_operacao)
      const monthKey = format(date, 'yyyy-MM')
      const monthLabel = format(date, 'MMM', { locale: pt })

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthLabel,
          total_print: 0,
          total_corte_impressao: 0,
          total_corte_chapas: 0,
        }
      }

      // Impressão
      if (operation.Tipo_Op === 'Impressao' && operation.num_placas_print) {
        monthlyData[monthKey].total_print += operation.num_placas_print
      }

      // Corte de Impressões (with source_impressao_id)
      if (
        operation.Tipo_Op === 'Corte' &&
        operation.num_placas_corte &&
        operation.source_impressao_id
      ) {
        monthlyData[monthKey].total_corte_impressao += operation.num_placas_corte
      }

      // Operações de Corte - Chapas Soltas (without source_impressao_id)
      if (
        operation.Tipo_Op === 'Corte' &&
        operation.num_placas_corte &&
        !operation.source_impressao_id
      ) {
        monthlyData[monthKey].total_corte_chapas += operation.num_placas_corte
      }
    })

    return Object.values(monthlyData).sort((a, b) =>
      a.month.localeCompare(b.month),
    )
  }, [operations])

  // Process data for operator print operations (Impressao only)
  const operatorPrintData = useMemo(() => {
    const operatorData: { [key: string]: OperatorMonthlyData } = {}
    const operatorNames: { [key: string]: string } = {}

    // First pass: collect operator names and initialize data structure
    // Only include operators with Impressão role (2e18fb9d-52ef-4216-90ea-699372cd5a87)
    operations
      .filter(
        (op) =>
          op.Tipo_Op === 'Impressao' &&
          op.operador_id &&
          op.profiles &&
          (op.profiles as any).role_id ===
            '2e18fb9d-52ef-4216-90ea-699372cd5a87',
      )
      .forEach((operation) => {
        const operatorName = `${operation.profiles!.first_name} ${operation.profiles!.last_name}`
        operatorNames[operation.operador_id!] = operatorName
      })

    // Second pass: aggregate data by month and operator
    operations
      .filter(
        (op) =>
          op.Tipo_Op === 'Impressao' && op.operador_id && op.num_placas_print,
      )
      .forEach((operation) => {
        if (!operation.data_operacao) return

        const date = new Date(operation.data_operacao)
        const monthKey = format(date, 'yyyy-MM')
        const monthLabel = format(date, 'MMM', { locale: pt })
        const operatorName = operatorNames[operation.operador_id!]

        if (!operatorData[monthKey]) {
          operatorData[monthKey] = { month: monthLabel }
          // Initialize all operators to 0 for this month
          Object.values(operatorNames).forEach((name) => {
            operatorData[monthKey][name] = 0
          })
        }

        if (operatorName) {
          operatorData[monthKey][operatorName] =
            ((operatorData[monthKey][operatorName] as number) || 0) +
            operation.num_placas_print!
        }
      })

    return {
      data: Object.values(operatorData).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
      operators: Object.values(operatorNames),
    }
  }, [operations])


  // Process data for operator corte operations
  const operatorCorteData = useMemo(() => {
    const operatorData: { [key: string]: OperatorMonthlyData } = {}
    const operatorNames: { [key: string]: string } = {}

    // First pass: collect operator names and initialize data structure
    // Only include operators with Corte role (968afe0b-0b14-46b2-9269-4fc9f120bbfa)
    operations
      .filter(
        (op) =>
          op.Tipo_Op === 'Corte' &&
          op.operador_id &&
          op.profiles &&
          (op.profiles as any).role_id ===
            '968afe0b-0b14-46b2-9269-4fc9f120bbfa',
      )
      .forEach((operation) => {
        const operatorName = `${operation.profiles!.first_name} ${operation.profiles!.last_name}`
        operatorNames[operation.operador_id!] = operatorName
      })

    // Second pass: aggregate data by month and operator
    operations
      .filter(
        (op) => op.Tipo_Op === 'Corte' && op.operador_id && op.num_placas_corte,
      )
      .forEach((operation) => {
        if (!operation.data_operacao) return

        const date = new Date(operation.data_operacao)
        const monthKey = format(date, 'yyyy-MM')
        const monthLabel = format(date, 'MMM', { locale: pt })
        const operatorName = operatorNames[operation.operador_id!]

        if (!operatorData[monthKey]) {
          operatorData[monthKey] = { month: monthLabel }
          // Initialize all operators to 0 for this month
          Object.values(operatorNames).forEach((name) => {
            operatorData[monthKey][name] = 0
          })
        }

        if (operatorName) {
          operatorData[monthKey][operatorName] =
            ((operatorData[monthKey][operatorName] as number) || 0) +
            operation.num_placas_corte!
        }
      })

    return {
      data: Object.values(operatorData).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
      operators: Object.values(operatorNames),
    }
  }, [operations])

  // Calculate overview totals
  const overviewTotals = useMemo(() => {
    const impressaoOps = operations.filter((op) => op.Tipo_Op === 'Impressao')
    const corteImpressaoOps = operations.filter(
      (op) => op.Tipo_Op === 'Corte' && op.source_impressao_id,
    )
    const corteChapasOps = operations.filter(
      (op) => op.Tipo_Op === 'Corte' && !op.source_impressao_id,
    )

    const totalPrint = impressaoOps.reduce(
      (sum, op) => sum + (op.num_placas_print || 0),
      0,
    )
    const totalCorteImpressao = corteImpressaoOps.reduce(
      (sum, op) => sum + (op.num_placas_corte || 0),
      0,
    )
    const totalCorteChapas = corteChapasOps.reduce(
      (sum, op) => sum + (op.num_placas_corte || 0),
      0,
    )

    return { totalPrint, totalCorteImpressao, totalCorteChapas }
  }, [operations])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Carregando análises...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-destructive bg-destructive/10 p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-destructive">
                Erro ao carregar análises
              </h3>
              <p className="mt-1 text-destructive">{error}</p>
            </div>
            <Button size="sm" onClick={handleRefresh}>
              <RotateCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (operations.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <Package className="mb-4 h-12 w-12" />
        <h3 className="text-lg font-semibold">
          Nenhuma Operação Encontrada
        </h3>
        <p>
          Não existem operações de produção para o ano atual.
        </p>
        <Button className="mt-4" onClick={handleRefresh}>
          <RotateCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>
    )
  }

  const printOperatorColors = generateOperatorColors(
    operatorPrintData.operators.length,
  )
  const corteOperatorColors = generateOperatorColors(
    operatorCorteData.operators.length,
  )

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          Análises de Produção {new Date().getFullYear()}
        </h2>
        <Button
          size="icon"
          onClick={handleRefresh}
          className="h-10 w-10"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="impressao">Impressão</TabsTrigger>
          <TabsTrigger value="corte_impressao">Corte de Impressões</TabsTrigger>
          <TabsTrigger value="corte_chapas">Operações Corte (Chapas)</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Overview cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border p-4">
              <h3 className="text-sm font-medium">
                Total Impressão
              </h3>
              <p className="text-2xl font-bold">
                {overviewTotals.totalPrint.toLocaleString()}
              </p>
            </Card>

            <Card className="border p-4">
              <h3 className="text-sm font-medium">
                Total Corte de Impressões
              </h3>
              <p className="text-2xl font-bold">
                {overviewTotals.totalCorteImpressao.toLocaleString()}
              </p>
            </Card>

            <Card className="border p-4">
              <h3 className="text-sm font-medium">
                Total Corte Chapas Soltas
              </h3>
              <p className="text-2xl font-bold">
                {overviewTotals.totalCorteChapas.toLocaleString()}
              </p>
            </Card>

            <Card className="border p-4">
              <h3 className="text-sm font-medium">
                Total Placas
              </h3>
              <p className="text-2xl font-bold">
                {(
                  overviewTotals.totalPrint +
                  overviewTotals.totalCorteImpressao +
                  overviewTotals.totalCorteChapas
                ).toLocaleString()}
              </p>
            </Card>
          </div>

          {/* Monthly totals charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border p-4">
              <div className="mb-4">
                <h3 className="text-lg leading-tight font-semibold">
                  Total Impressão por Mês
                </h3>
                <p className="text-sm leading-tight">
                  Número de placas
                </p>
              </div>
              <ResponsiveContainer width="100%" height={450}>
                <BarChart
                  data={monthlyTotals as any}
                  margin={{ top: 40, right: 40, left: 40, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  {/* @ts-ignore */}
                  <XAxis dataKey="month" />
                  {/* @ts-ignore */}
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      'Placas',
                    ]}
                    labelStyle={{ color: '#333' }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                    }}
                  />
                  <Bar dataKey="total_print" name="Impressão" fill={CHART_COLORS.print} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="border p-4">
              <div className="mb-4">
                <h3 className="text-lg leading-tight font-semibold">
                  Total Corte por Mês
                </h3>
                <p className="text-sm leading-tight">
                  Número de placas
                </p>
              </div>
              <ResponsiveContainer width="100%" height={450}>
                <BarChart
                  data={monthlyTotals}
                  margin={{ top: 40, right: 40, left: 40, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  {/* @ts-ignore */}
                  <XAxis dataKey="month" />
                  {/* @ts-ignore */}
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name,
                    ]}
                    labelStyle={{ color: '#333' }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                    }}
                  />
                  <Bar dataKey="total_corte_impressao" name="Corte de Impressões" fill={CHART_COLORS.corteImpressao} />
                  <Bar dataKey="total_corte_chapas" name="Corte Chapas Soltas" fill={CHART_COLORS.corteChapas} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="impressao" className="space-y-4">
          <Card className="border p-4">
            <div className="mb-4">
              <h3 className="text-lg leading-tight font-semibold">
                Impressão por Operador
              </h3>
              <p className="text-sm leading-tight">
                Número de placas
              </p>
            </div>
            {operatorPrintData.operators.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={operatorPrintData.data}
                  margin={{ top: 20, right: 30, left: 30, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  {/* @ts-ignore */}
                  <XAxis dataKey="month" />
                  {/* @ts-ignore */}
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name,
                    ]}
                    labelStyle={{ color: '#333' }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                    }}
                  />
                  {operatorPrintData.operators.map((operator, index) => (
                    <Bar
                      key={operator}
                      dataKey={operator}
                      fill={printOperatorColors[index]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <Package className="mb-4 h-12 w-12" />
                <h3 className="text-lg font-semibold">
                  Nenhum Dado de Impressão
                </h3>
                <p>
                  Não existem operações de impressão com operadores definidos.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="corte_impressao" className="space-y-4">
          <Card className="border p-4">
            <div className="mb-4">
              <h3 className="text-lg leading-tight font-semibold">
                Corte de Impressões por Operador
              </h3>
              <p className="text-sm leading-tight">
                Número de placas
              </p>
            </div>
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <Package className="mb-4 h-12 w-12" />
              <h3 className="text-lg font-semibold">
                Em Desenvolvimento
              </h3>
              <p>
                Gráficos de Corte de Impressões serão adicionados em breve.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="corte_chapas" className="space-y-4">
          <Card className="border p-4">
            <div className="mb-4">
              <h3 className="text-lg leading-tight font-semibold">
                Corte por Operador
              </h3>
              <p className="text-sm leading-tight">
                Número de placas
              </p>
            </div>
            {operatorCorteData.operators.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={operatorCorteData.data}
                  margin={{ top: 20, right: 30, left: 30, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  {/* @ts-ignore */}
                  <XAxis dataKey="month" />
                  {/* @ts-ignore */}
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(),
                      name,
                    ]}
                    labelStyle={{ color: '#333' }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                    }}
                  />
                  {operatorCorteData.operators.map((operator, index) => (
                    <Bar
                      key={operator}
                      dataKey={operator}
                      fill={corteOperatorColors[index]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <Package className="mb-4 h-12 w-12" />
                <h3 className="text-lg font-semibold">
                  Nenhum Dado de Corte
                </h3>
                <p>
                  Não existem operações de corte com operadores definidos.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

