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
  profiles?: {
    first_name?: string
    last_name?: string
    role_id?: string
  }
}

interface MonthlyData {
  month: string
  total_print: number
  total_print_vinil: number
  total_corte: number
}

interface OperatorMonthlyData {
  month: string
  [key: string]: string | number // Dynamic operator names as keys
}

interface ProductionAnalyticsChartsProps {
  supabase: any
  onRefresh?: () => Promise<void>
}

// Chart color palette using CSS variables from design system
// Colors are defined in globals.css and adapt to light/dark mode
const CHART_COLORS = {
  print: MATERIAL_COLORS.RIGIDOS(), // Muted teal blue - for regular print operations
  printVinil: MATERIAL_COLORS.FLEXIVEIS(), // Earthy green - for vinyl print operations
  corte: MATERIAL_COLORS.CARTAO(), // Soft pastel yellow - for corte operations
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
          profiles!operador_id (
            first_name, 
            last_name,
            role_id
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
    console.log(
      '🔍 Processing monthly totals - total operations:',
      operations.length,
    )

    // Debug: Show all operation types
    const operationTypes = operations.map((op) => op.Tipo_Op).filter(Boolean)
    console.log(
      '📊 Operation types found:',
      Array.from(new Set(operationTypes)),
    )

    // Debug: Count operations by type
    const typeCounts = operationTypes.reduce(
      (acc, type) => {
        if (type) {
          acc[type] = (acc[type] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>,
    )
    console.log('📈 Operation counts by type:', typeCounts)

    // Debug: Show Impressao_Flexiveis operations specifically
    const impressaoVinilOps = operations.filter(
      (op) => op.Tipo_Op === 'Impressao_Flexiveis',
    )
    console.log(
      '🎨 Impressao_Flexiveis operations found:',
      impressaoVinilOps.length,
    )
    if (impressaoVinilOps.length > 0) {
      console.log(
        '🎨 Impressao_Flexiveis operations details:',
        impressaoVinilOps.map((op) => ({
          id: op.id,
          data_operacao: op.data_operacao,
          num_placas_print: op.num_placas_print,
          operador_id: op.operador_id,
        })),
      )
    }

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
          total_print_vinil: 0,
          total_corte: 0,
        }
      }

      if (operation.Tipo_Op === 'Impressao' && operation.num_placas_print) {
        monthlyData[monthKey].total_print += operation.num_placas_print
        console.log(
          `➕ Added ${operation.num_placas_print} to Impressao for ${monthLabel}`,
        )
      }

      if (
        operation.Tipo_Op === 'Impressao_Flexiveis' &&
        operation.num_placas_print
      ) {
        monthlyData[monthKey].total_print_vinil += operation.num_placas_print
        console.log(
          `🎨 Added ${operation.num_placas_print} to Impressao_Flexiveis for ${monthLabel}`,
        )
      }

      if (operation.Tipo_Op === 'Corte' && operation.num_placas_corte) {
        monthlyData[monthKey].total_corte += operation.num_placas_corte
        console.log(
          `✂️ Added ${operation.num_placas_corte} to Corte for ${monthLabel}`,
        )
      }
    })

    const result = Object.values(monthlyData).sort((a, b) =>
      a.month.localeCompare(b.month),
    )

    console.log('📊 Final monthly totals:', result)
    return result
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

  // Process data for operator vinyl print operations (Impressao_Flexiveis)
  const operatorPrintVinilData = useMemo(() => {
    console.log('🎨 Processing Impressao_Flexiveis operator data...')

    const operatorData: { [key: string]: OperatorMonthlyData } = {}
    const operatorNames: { [key: string]: string } = {}

    // Debug: Find all Impressao_Flexiveis operations
    const vinilOps = operations.filter(
      (op) => op.Tipo_Op === 'Impressao_Flexiveis',
    )
    console.log('🎨 Total Impressao_Flexiveis operations:', vinilOps.length)

    // Debug: Check which have operators
    const vinilOpsWithOperators = vinilOps.filter((op) => op.operador_id)
    console.log(
      '🎨 Impressao_Flexiveis operations with operador_id:',
      vinilOpsWithOperators.length,
    )

    // Debug: Check which have profiles
    const vinilOpsWithProfiles = vinilOpsWithOperators.filter(
      (op) => op.profiles,
    )
    console.log(
      '🎨 Impressao_Flexiveis operations with profiles:',
      vinilOpsWithProfiles.length,
    )

    if (vinilOpsWithProfiles.length > 0) {
      console.log('🎨 Sample Impressao_Flexiveis operation with profile:', {
        id: vinilOpsWithProfiles[0].id,
        operador_id: vinilOpsWithProfiles[0].operador_id,
        profiles: vinilOpsWithProfiles[0].profiles,
        role_id: (vinilOpsWithProfiles[0].profiles as any)?.role_id,
      })
    }

    // First pass: collect operator names and initialize data structure
    // Only include operators with Impressão role (2e18fb9d-52ef-4216-90ea-699372cd5a87)
    const validOps = operations.filter(
      (op) =>
        op.Tipo_Op === 'Impressao_Flexiveis' &&
        op.operador_id &&
        op.profiles &&
        (op.profiles as any).role_id === '2e18fb9d-52ef-4216-90ea-699372cd5a87',
    )

    console.log(
      '🎨 Impressao_Flexiveis operations with correct role:',
      validOps.length,
    )

    validOps.forEach((operation) => {
      const operatorName = `${operation.profiles!.first_name} ${operation.profiles!.last_name}`
      operatorNames[operation.operador_id!] = operatorName
      console.log('🎨 Added Impressao_Flexiveis operator:', operatorName)
    })

    console.log(
      '🎨 Total Impressao_Flexiveis operators found:',
      Object.keys(operatorNames).length,
    )

    // Second pass: aggregate data by month and operator
    operations
      .filter(
        (op) =>
          op.Tipo_Op === 'Impressao_Flexiveis' &&
          op.operador_id &&
          op.num_placas_print,
      )
      .forEach((operation) => {
        if (!operation.data_operacao) return

        const date = new Date(operation.data_operacao)
        const monthKey = format(date, 'yyyy-MM')
        const monthLabel = format(date, 'MMM', { locale: pt })
        const operatorName = operatorNames[operation.operador_id!]

        console.log(
          `🎨 Processing Impressao_Flexiveis operation: ${monthLabel}, operator: ${operatorName}, quantity: ${operation.num_placas_print}`,
        )

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
          console.log(
            `🎨 Updated operator ${operatorName} total for ${monthLabel}: ${operatorData[monthKey][operatorName]}`,
          )
        }
      })

    const result = {
      data: Object.values(operatorData).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
      operators: Object.values(operatorNames),
    }

    console.log('🎨 Final Impressao_Flexiveis operator data:', result)
    return result
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
    console.log('📊 Calculating overview totals...')

    const impressaoOps = operations.filter((op) => op.Tipo_Op === 'Impressao')
    const impressaoVinilOps = operations.filter(
      (op) => op.Tipo_Op === 'Impressao_Flexiveis',
    )
    const corteOps = operations.filter((op) => op.Tipo_Op === 'Corte')

    console.log(
      `📊 Operations found - Impressao: ${impressaoOps.length}, Impressao_Flexiveis: ${impressaoVinilOps.length}, Corte: ${corteOps.length}`,
    )

    const totalPrint = impressaoOps.reduce(
      (sum, op) => sum + (op.num_placas_print || 0),
      0,
    )
    const totalPrintVinil = impressaoVinilOps.reduce(
      (sum, op) => sum + (op.num_placas_print || 0),
      0,
    )
    const totalCorte = corteOps.reduce(
      (sum, op) => sum + (op.num_placas_corte || 0),
      0,
    )

    console.log(
      `📊 Totals calculated - Impressao: ${totalPrint}, Impressao_Vinil: ${totalPrintVinil}, Corte: ${totalCorte}`,
    )

    if (impressaoVinilOps.length > 0) {
      console.log(
        '📊 Sample Impressao_Vinil operations:',
        impressaoVinilOps.slice(0, 3).map((op) => ({
          id: op.id,
          Tipo_Op: op.Tipo_Op,
          num_placas_print: op.num_placas_print,
          data_operacao: op.data_operacao,
        })),
      )
    }

    return { totalPrint, totalPrintVinil, totalCorte }
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
  const printVinilOperatorColors = generateOperatorColors(
    operatorPrintVinilData.operators.length,
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
          <TabsTrigger value="print">Impressão</TabsTrigger>
          <TabsTrigger value="print-vinil">Impressão Flexíveis</TabsTrigger>
          <TabsTrigger value="corte">Corte</TabsTrigger>
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
                Total Impressão Flexíveis
              </h3>
              <p className="text-2xl font-bold">
                {overviewTotals.totalPrintVinil.toLocaleString()}
              </p>
            </Card>

            <Card className="border p-4">
              <h3 className="text-sm font-medium">
                Total Corte
              </h3>
              <p className="text-2xl font-bold">
                {overviewTotals.totalCorte.toLocaleString()}
              </p>
            </Card>

            <Card className="border p-4">
              <h3 className="text-sm font-medium">
                Total Placas
              </h3>
              <p className="text-2xl font-bold">
                {(
                  overviewTotals.totalPrint +
                  overviewTotals.totalPrintVinil +
                  overviewTotals.totalCorte
                ).toLocaleString()}
              </p>
            </Card>
          </div>

          {/* Monthly totals charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
                  data={monthlyTotals}
                  margin={{ top: 40, right: 40, left: 40, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
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
                  <Bar dataKey="total_print" fill={CHART_COLORS.print} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="border p-4">
              <div className="mb-4">
                <h3 className="text-lg leading-tight font-semibold">
                  Total Impressão Flexíveis por Mês
                </h3>
                <p className="text-sm leading-tight">
                  Número de metros lineares
                </p>
              </div>
              <ResponsiveContainer width="100%" height={450}>
                <BarChart
                  data={monthlyTotals}
                  margin={{ top: 40, right: 40, left: 40, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      'Metros',
                    ]}
                    labelStyle={{ color: '#333' }}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #ccc',
                    }}
                  />
                  <Bar
                    dataKey="total_print_vinil"
                    fill={CHART_COLORS.printVinil}
                  />
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
                  <XAxis dataKey="month" />
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
                  <Bar dataKey="total_corte" fill={CHART_COLORS.corte} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="print" className="space-y-4">
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
                  <XAxis dataKey="month" />
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

        <TabsContent value="print-vinil" className="space-y-4">
          <Card className="border p-4">
            <div className="mb-4">
              <h3 className="text-lg leading-tight font-semibold">
                Impressão Flexíveis por Operador
              </h3>
              <p className="text-sm leading-tight">
                Número de metros lineares
              </p>
            </div>
            {operatorPrintVinilData.operators.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={operatorPrintVinilData.data}
                  margin={{ top: 20, right: 30, left: 30, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
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
                  {operatorPrintVinilData.operators.map((operator, index) => (
                    <Bar
                      key={operator}
                      dataKey={operator}
                      fill={printVinilOperatorColors[index]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <Package className="mb-4 h-12 w-12" />
                <h3 className="text-lg font-semibold">
                  Nenhum Dado de Impressão Flexíveis
                </h3>
                <p>
                  Não existem operações de impressão flexíveis com operadores
                  definidos.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="corte" className="space-y-4">
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
                  <XAxis dataKey="month" />
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

