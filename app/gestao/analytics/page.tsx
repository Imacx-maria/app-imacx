'use client'

/**
 * Gestão - Analytics Page
 * --------------------------------------------------------------
 * Financial analytics with cards and charts
 * Based on data from visão geral tab from the original faturação page
 * 
 * Tab 1: Overview Cards - Key metrics in card format
 * Tab 2: Charts - Visual representations of the data
 */

import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Tabs, TabsList, TabsContent, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowUp,
  ArrowDown,
  Loader2,
  RotateCw,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/* ---------- Types ---------- */

interface MetricCard {
  title: string
  currentValue: number
  previousValue: number
  formatter?: (value: number) => string
  subtitle: string
  colorClass?: string
}

interface AnalyticsData {
  revenueCards: MetricCard[]
  quotesCards: MetricCard[]
  comprasCards: MetricCard[]
}

interface DepartmentMetrics {
  department: string
  faturacaoYTD: number
  faturacaoLY: number
  notasYTD: number
  notasLY: number
  receitaLiquidaYTD: number
  receitaLiquidaLY: number
  nrFaturasYTD: number
  nrFaturasLY: number
  nrNotasYTD: number
  nrNotasLY: number
  ticketMedioYTD: number
  ticketMedioLY: number
  orcamentosValorYTD: number
  orcamentosValorLY: number
  orcamentosQtdYTD: number
  orcamentosQtdLY: number
  taxaConversaoYTD: number
  taxaConversaoLY: number
}

/* ---------- Helper Functions ---------- */

const currency = (value: number) =>
  new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)

const percent = (value: number) => `${value.toFixed(1)}%`

const number = (value: number) => Math.round(value).toLocaleString('pt-PT')

/* ---------- Components ---------- */

const MetricCard = ({ card }: { card: MetricCard }) => {
  const formatter = card.formatter || number
  const change = card.currentValue - card.previousValue
  const changePercent =
    card.previousValue !== 0
      ? ((change / card.previousValue) * 100)
      : 0
  const isPositive = change >= 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {card.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className={`text-2xl font-bold ${card.colorClass || ''}`}>
            {formatter(card.currentValue)}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{card.subtitle}</span>
            <div
              className={`flex items-center gap-1 font-medium ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {changePercent.toFixed(1)}%
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Anterior: {formatter(card.previousValue)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const MetricCardSet = ({
  title,
  cards,
  legend,
}: {
  title: string
  cards: MetricCard[]
  legend?: string
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {legend && <p className="text-xs text-muted-foreground mt-1">{legend}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <MetricCard key={index} card={card} />
        ))}
      </div>
    </div>
  )
}

/* ---------- Main Component ---------- */

export default function AnalyticsPage() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [departmentData, setDepartmentData] = useState<DepartmentMetrics[]>([])
  const [totalsData, setTotalsData] = useState<DepartmentMetrics | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'cards' | 'charts'>('cards')
  const [isSyncing, setIsSyncing] = useState(false)

  const currentYear = new Date().getFullYear()
  const previousYear = currentYear - 1

  /* ---------- Data Fetching ---------- */

  const fetchAnalyticsData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Calculate YTD date range for comparison
      const today = new Date()
      const currentDayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
      const previousYearSameDay = new Date(previousYear, 0, currentDayOfYear)

      // Helper to normalize document types
      const normalizeDocType = (value: string | null | undefined): string => {
        if (!value) return ''
        const normalized = value.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
        if (normalized.includes('nota') && normalized.includes('credito')) return 'nota_de_credito'
        if (normalized.includes('factura') || normalized.includes('fatura')) return 'factura'
        if (normalized.includes('orcamento')) return 'orcamento'
        return normalized
      }

      // Helper to check if invoice is cancelled
      const isNotCancelled = (anulado: any): boolean => {
        return !anulado || anulado === '' || anulado === '0'
      }

      console.log('💳 Overview Cards Data Fetch - Using phc.ft + phc.2years_ft and phc.bo + phc.2years_bo')
      console.log('  Current Year:', currentYear, '| Previous Year:', previousYear)
      console.log('  YTD Comparison Date:', previousYearSameDay.toISOString().split('T')[0])

      // Helper to fetch all rows (pagination to get around 1000 row limit)
      const fetchAllRows = async (table: string, schema: string, columns: string, filters: {gte?: string, lte?: string, dateColumn: string}) => {
        let allRows: any[] = []
        let offset = 0
        let hasMore = true
        
        while (hasMore) {
          const query = supabase
            .schema(schema)
            .from(table)
            .select(columns)
          
          if (filters.gte) {
            query.gte(filters.dateColumn, filters.gte)
          }
          if (filters.lte) {
            query.lte(filters.dateColumn, filters.lte)
          }
          
          const { data, error } = await query.range(offset, offset + 999)
          
          if (error) throw error
          if (!data || data.length === 0) {
            hasMore = false
          } else {
            allRows = allRows.concat(data)
            if (data.length < 1000) {
              hasMore = false
            }
            offset += 1000
          }
        }
        
        return allRows
      }

      // Fetch all invoices and quotes with pagination
      const currentYearInvoices = await fetchAllRows('ft', 'phc', 'document_type, net_value, anulado, invoice_date', {
        gte: `${currentYear}-01-01`,
        lte: today.toISOString().split('T')[0],
        dateColumn: 'invoice_date'
      })
      const ftCurrentError = !currentYearInvoices ? new Error('Failed to fetch current year invoices') : null

      const previousYearInvoices = await fetchAllRows('2years_ft', 'phc', 'document_type, net_value, anulado, invoice_date', {
        gte: `${previousYear}-01-01`,
        lte: previousYearSameDay.toISOString().split('T')[0],
        dateColumn: 'invoice_date'
      })
      const ftPrevError = !previousYearInvoices ? new Error('Failed to fetch previous year invoices') : null

      const currentYearQuotes = await fetchAllRows('bo', 'phc', 'document_type, total_value, document_date', {
        gte: `${currentYear}-01-01`,
        lte: today.toISOString().split('T')[0],
        dateColumn: 'document_date'
      })
      const boCurrentError = !currentYearQuotes ? new Error('Failed to fetch current year quotes') : null

      const previousYearQuotes = await fetchAllRows('2years_bo', 'phc', 'document_type, total_value, document_date', {
        gte: `${previousYear}-01-01`,
        lte: previousYearSameDay.toISOString().split('T')[0],
        dateColumn: 'document_date'
      })
      const boPrevError = !previousYearQuotes ? new Error('Failed to fetch previous year quotes') : null

      const currentYearPurchases = await fetchAllRows('fo', 'phc', 'net_liquid_value, document_date', {
        gte: `${currentYear}-01-01`,
        lte: today.toISOString().split('T')[0],
        dateColumn: 'document_date'
      })
      const fiCurrentError = !currentYearPurchases ? new Error('Failed to fetch current year purchases') : null

      const previousYearPurchases = await fetchAllRows('2years_fi', 'phc', 'net_liquid_value, invoice_date', {
        gte: `${previousYear}-01-01`,
        lte: previousYearSameDay.toISOString().split('T')[0],
        dateColumn: 'invoice_date'
      })
      const fiPrevError = !previousYearPurchases ? new Error('Failed to fetch previous year purchases') : null

      if (ftCurrentError) throw ftCurrentError
      if (ftPrevError) throw ftPrevError
      if (boCurrentError) throw boCurrentError
      if (boPrevError) throw boPrevError
      if (fiCurrentError) throw fiCurrentError
      if (fiPrevError) throw fiPrevError
      
      console.log('  Current Year (2025) Invoices:', currentYearInvoices?.length || 0, 'rows')
      console.log('  Previous Year (2024) Invoices:', previousYearInvoices?.length || 0, 'rows')
      console.log('  Current Year (2025) Quotes:', currentYearQuotes?.length || 0, 'rows')
      console.log('  Previous Year (2024) Quotes:', previousYearQuotes?.length || 0, 'rows')
      console.log('  Current Year (2025) Purchases:', currentYearPurchases?.length || 0, 'rows')
      console.log('  Previous Year (2024) Purchases:', previousYearPurchases?.length || 0, 'rows')
      
      console.log('📋 Raw Quotes Data (2025):', currentYearQuotes)
      console.log('📋 Raw Quotes Data (2024):', previousYearQuotes)

      // Calculate metrics for a specific year
      const calculateMetrics = (invoices: any[], quotes: any[], purchases: any[]) => {
        // Facturação: Sum ALL (Factura + Nota de Crédito) MINUS Facturas with anulado='False'
        let totalFacturaNotaValue = 0
        let cancelledFacturaValue = 0
        let nonCancelledFaturasValue = 0  // Sum of only non-cancelled Facturas (for Ticket Médio)
        let faturasCount = 0
        let notasValue = 0
        let notasCount = 0
        let orcamentosValue = 0
        let orcamentosCount = 0
        let comprasValue = 0

        // Process invoices (phc.ft or phc.2years_ft)
        invoices?.forEach((row: any) => {
          const docType = normalizeDocType(row.document_type)
          const value = Number(row.net_value || 0)
          
          if (docType === 'factura' || docType === 'nota_de_credito') {
            totalFacturaNotaValue += value
            
            // Track cancelled facturas separately
            if (docType === 'factura' && row.anulado === 'False') {
              cancelledFacturaValue += value
            }
            // Count and sum non-cancelled facturas
            if (docType === 'factura' && row.anulado !== 'False') {
              faturasCount += 1
              nonCancelledFaturasValue += value
            }
            // Count notas
            if (docType === 'nota_de_credito') {
              notasCount += 1
              notasValue += value
            }
          }
        })

        // Facturação Value = Total (Factura + Nota) - Cancelled Facturas
        const faturasValue = totalFacturaNotaValue - cancelledFacturaValue

        // Process quotes (phc.bo or phc.2years_bo)
        quotes?.forEach((row: any) => {
          const docType = normalizeDocType(row.document_type)
          const value = Number(row.total_value || 0)
          
          // Orçamentos: document_type = 'Orçamento'
          if (docType === 'orcamento') {
            orcamentosValue += value
            orcamentosCount += 1
          }
        })

        // Process purchases (phc.fo or phc.2years_fi)
        purchases?.forEach((row: any) => {
          const value = Number(row.net_liquid_value || 0)
          comprasValue += value
        })

        // Receita Líquida = Facturação Value + Notas Value
        const netRevenue = faturasValue + notasValue
        
        // Ticket Médio = Sum of non-cancelled Facturas / Nº Facturas (non-cancelled)
        const avgFactura = faturasCount > 0 ? nonCancelledFaturasValue / faturasCount : 0
        
        // Taxa Conversão = (Nº Faturas / Nº Orçamentos) × 100
        const conversion = orcamentosCount > 0 
          ? (faturasCount / orcamentosCount) * 100
          : 0

        return {
          faturasValue,
          faturasCount,
          notasValue,
          notasCount,
          netRevenue,
          avgFactura,
          orcamentosValue,
          orcamentosCount,
          conversion,
          comprasValue,
        }
      }

      const metricsCurrentYear = calculateMetrics(currentYearInvoices || [], currentYearQuotes || [], currentYearPurchases || [])
      const metricsPreviousYear = calculateMetrics(previousYearInvoices || [], previousYearQuotes || [], previousYearPurchases || [])
      
      // Debug: Log calculated metrics
      console.log('📊 Calculated Metrics:')
      console.log('  Current Year (2025):', metricsCurrentYear)
      console.log('  Previous Year (2024):', metricsPreviousYear)

      // Build cards
      const revenueCards: MetricCard[] = [
        {
          title: `Receita Líquida YTD ${currentYear}`,
          currentValue: metricsCurrentYear.faturasValue,
          previousValue: metricsPreviousYear.faturasValue,
          formatter: currency,
          subtitle: `vs ${previousYear}`,
          colorClass: 'text-emerald-600',
        },
        {
          title: `Nº Faturas ${currentYear}`,
          currentValue: metricsCurrentYear.faturasCount,
          previousValue: metricsPreviousYear.faturasCount,
          subtitle: `vs ${previousYear}`,
        },
        {
          title: `Ticket Médio ${currentYear}`,
          currentValue: metricsCurrentYear.avgFactura,
          previousValue: metricsPreviousYear.avgFactura,
          formatter: currency,
          subtitle: `vs ${previousYear}`,
        },
      ]

      const quotesCards: MetricCard[] = [
        {
          title: `Orçamentos Valor YTD ${currentYear}`,
          currentValue: metricsCurrentYear.orcamentosValue,
          previousValue: metricsPreviousYear.orcamentosValue,
          formatter: currency,
          subtitle: `vs ${previousYear}`,
          colorClass: 'text-purple-600',
        },
        {
          title: `Orçamentos Qtd YTD ${currentYear}`,
          currentValue: metricsCurrentYear.orcamentosCount,
          previousValue: metricsPreviousYear.orcamentosCount,
          subtitle: `vs ${previousYear}`,
        },
        {
          title: `Taxa Conversão YTD ${currentYear}`,
          currentValue: metricsCurrentYear.conversion,
          previousValue: metricsPreviousYear.conversion,
          formatter: percent,
          subtitle: `vs ${previousYear}`,
          colorClass: 'text-indigo-600',
        },
      ]

      const comprasCards: MetricCard[] = [
        {
          title: `Compras YTD ${currentYear}`,
          currentValue: metricsCurrentYear.comprasValue,
          previousValue: metricsPreviousYear.comprasValue,
          formatter: currency,
          subtitle: `vs ${previousYear}`,
          colorClass: 'text-red-600',
        },
      ]

      setData({
        revenueCards,
        quotesCards,
        comprasCards,
      })

      // Fetch department ranking data
      await fetchDepartmentRankings()
    } catch (err: any) {
      console.error('Error fetching analytics data:', err)
      setError(err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }


  const fetchDepartmentRankings = async () => {
    try {
      console.log('📊 Fetching Department Rankings via SQL query...')
      
      // Execute the comprehensive SQL query via RPC
      const { data: deptRankings, error } = await supabase.rpc('get_department_rankings_ytd')
      
      if (error) {
        console.error('❌ Error fetching department rankings:', error)
        throw error
      }
      
      if (!deptRankings || deptRankings.length === 0) {
        console.warn('⚠️ No department ranking data returned')
        setDepartmentData([])
        return
      }
      
      console.log(`✅ Fetched ${deptRankings.length} department rows (including TOTAL)`)
      
      // Extract TOTAL row separately
      const totalRow = deptRankings.find((row: any) => row.departamento === 'TOTAL')
      
      // Transform SQL results to DepartmentMetrics format
      const departments: DepartmentMetrics[] = deptRankings
        .filter((row: any) => row.departamento !== 'TOTAL' && row.departamento !== 'ADMIN' && row.departamento !== 'PRODUCAO')
        .map((row: any) => ({
          department: row.departamento,
          faturacaoYTD: Number(row.faturacao || 0),
          faturacaoLY: Number(row.faturacao_anterior || 0),
          notasYTD: Number(row.notas_credito || 0),
          notasLY: Number(row.notas_credito_anterior || 0),
          receitaLiquidaYTD: Number(row.faturacao || 0) - Number(row.notas_credito || 0),
          receitaLiquidaLY: Number(row.faturacao_anterior || 0) - Number(row.notas_credito_anterior || 0),
          nrFaturasYTD: Number(row.num_faturas || 0),
          nrFaturasLY: Number(row.num_faturas_anterior || 0),
          nrNotasYTD: Number(row.num_notas || 0),
          nrNotasLY: Number(row.num_notas_anterior || 0),
          ticketMedioYTD: Number(row.ticket_medio || 0),
          ticketMedioLY: Number(row.ticket_medio_anterior || 0),
          orcamentosValorYTD: Number(row.orcamentos_valor || 0),
          orcamentosValorLY: Number(row.orcamentos_valor_anterior || 0),
          orcamentosQtdYTD: Number(row.orcamentos_qtd || 0),
          orcamentosQtdLY: Number(row.orcamentos_qtd_anterior || 0),
          taxaConversaoYTD: Number(row.taxa_conversao || 0),
          taxaConversaoLY: Number(row.taxa_conversao_anterior || 0),
        }))
      
      // Transform TOTAL row if it exists
      if (totalRow) {
        const totals: DepartmentMetrics = {
          department: 'TOTAL',
          faturacaoYTD: Number(totalRow.faturacao || 0),
          faturacaoLY: Number(totalRow.faturacao_anterior || 0),
          notasYTD: Number(totalRow.notas_credito || 0),
          notasLY: Number(totalRow.notas_credito_anterior || 0),
          receitaLiquidaYTD: Number(totalRow.faturacao || 0) - Number(totalRow.notas_credito || 0),
          receitaLiquidaLY: Number(totalRow.faturacao_anterior || 0) - Number(totalRow.notas_credito_anterior || 0),
          nrFaturasYTD: Number(totalRow.num_faturas || 0),
          nrFaturasLY: Number(totalRow.num_faturas_anterior || 0),
          nrNotasYTD: Number(totalRow.num_notas || 0),
          nrNotasLY: Number(totalRow.num_notas_anterior || 0),
          ticketMedioYTD: Number(totalRow.ticket_medio || 0),
          ticketMedioLY: Number(totalRow.ticket_medio_anterior || 0),
          orcamentosValorYTD: Number(totalRow.orcamentos_valor || 0),
          orcamentosValorLY: Number(totalRow.orcamentos_valor_anterior || 0),
          orcamentosQtdYTD: Number(totalRow.orcamentos_qtd || 0),
          orcamentosQtdLY: Number(totalRow.orcamentos_qtd_anterior || 0),
          taxaConversaoYTD: Number(totalRow.taxa_conversao || 0),
          taxaConversaoLY: Number(totalRow.taxa_conversao_anterior || 0),
        }
        setTotalsData(totals)
      }
      
      // Debug: Log aggregated department data
      console.log('📈 Department Metrics from SQL:')
      departments.forEach(dept => {
        console.log(`  ${dept.department}:`, {
          faturacaoLY: dept.faturacaoLY,
          faturacaoYTD: dept.faturacaoYTD,
          notasLY: dept.notasLY,
          notasYTD: dept.notasYTD,
          receitaLiquidaYTD: dept.receitaLiquidaYTD
        })
      })

      setDepartmentData(departments)
    } catch (err: any) {
      console.error('Error fetching department rankings:', err)
      // Don't fail the whole page if department data fails
      setDepartmentData([])
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            A carregar indicadores financeiros...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-semibold text-destructive">
            Erro ao carregar dados
          </p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={fetchAnalyticsData}>
            <RotateCw className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Análises Financeiras
          </h1>
          <p className="text-muted-foreground">
            Indicadores financeiros e análises de desempenho
          </p>
          <p className="text-xs text-green-600 dark:text-green-500">
            ✓ Dados PHC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={async () => {
                    setIsSyncing(true)
                    try {
                      console.log('🔄 Starting ETL sync (today_all)...')
                      const resp = await fetch('/api/etl/incremental', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'today_all' }),
                      })
                      
                      console.log('📡 ETL API Response Status:', resp.status)
                      
                      if (!resp.ok) {
                        const body = await resp.json().catch(() => ({}) as any)
                        console.error('❌ ETL today sync failed:', {
                          status: resp.status,
                          statusText: resp.statusText,
                          body: body
                        })
                        alert(`Falhou a sincronização (ETL).\nStatus: ${resp.status}\nDetalhes: ${JSON.stringify(body, null, 2)}`)
                        return
                      }
                      
                      const result = await resp.json()
                      console.log('✅ ETL sync completed:', result)
                      
                      // Refresh data after successful sync
                      await fetchAnalyticsData()
                    } catch (e) {
                      console.error('❌ Erro ao executar sincronização:', e)
                      alert(`Erro ao executar sincronização: ${e instanceof Error ? e.message : 'Unknown error'}`)
                    } finally {
                      setIsSyncing(false)
                    }
                  }}
                  variant="outline"
                  size="icon"
                  className="border border-black"
                  disabled={isSyncing || loading}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sincronizar e Atualizar Dados (Hoje)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cards">Visão Geral</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
        </TabsList>

        {/* Cards Tab */}
        <TabsContent
          value="cards"
          className="space-y-6 mt-6"
        >
          {data && (
            <>
              {/* Revenue Cards */}
              <MetricCardSet
                title={`💰 Facturação ${currentYear} vs ${previousYear}`}
                cards={data.revenueCards}
                legend="Facturas - Anuladas - Notas Crédito"
              />

              {/* Quotes Cards */}
              <MetricCardSet
                title={`📋 Orçamentos ${currentYear} vs ${previousYear}`}
                cards={data.quotesCards}
              />

              <MetricCardSet
                title={`💰 Compras ${currentYear} vs ${previousYear}`}
                cards={data.comprasCards}
              />
            </>
          )}
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent
          value="charts"
          className="space-y-6 mt-6"
        >
          <div className="space-y-6">
            {/* Vendedores/Department Rankings Table */}
            <Card>
              <CardHeader>
                <CardTitle>Ranking de Departamentos</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Comparação de desempenho por departamento - YTD {currentYear} vs {previousYear}
                </p>
              </CardHeader>
              <CardContent>
                {departmentData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table className="w-full [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">DEPARTAMENTO</TableHead>
                          <TableHead className="text-right">Facturação</TableHead>
                          <TableHead className="text-right">Notas Crédito</TableHead>
                          <TableHead className="text-right">Receita Líquida</TableHead>
                          <TableHead className="text-right">Nº Faturas</TableHead>
                          <TableHead className="text-right">Nº Notas</TableHead>
                          <TableHead className="text-right">Ticket Médio</TableHead>
                          <TableHead className="text-right">Orçamentos €</TableHead>
                          <TableHead className="text-right">Orçamentos Qtd</TableHead>
                          <TableHead className="text-right">Taxa Conv.</TableHead>
                          <TableHead className="text-center w-[100px]">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {departmentData.map((dept) => {
                          const isExpanded = expandedRows.has(dept.department)
                          const calcChange = (current: number, previous: number) => {
                            if (previous === 0) return { percent: 0, isPositive: true }
                            const change = ((current - previous) / previous) * 100
                            return { percent: change, isPositive: change >= 0 }
                          }

                          const faturacaoChange = calcChange(dept.faturacaoYTD, dept.faturacaoLY)
                          const notasChange = calcChange(dept.notasYTD, dept.notasLY)
                          const receitaChange = calcChange(dept.receitaLiquidaYTD, dept.receitaLiquidaLY)
                          const nrFaturasChange = calcChange(dept.nrFaturasYTD, dept.nrFaturasLY)
                          const nrNotasChange = calcChange(dept.nrNotasYTD, dept.nrNotasLY)
                          const ticketChange = calcChange(dept.ticketMedioYTD, dept.ticketMedioLY)
                          const orcValorChange = calcChange(dept.orcamentosValorYTD, dept.orcamentosValorLY)
                          const orcQtdChange = calcChange(dept.orcamentosQtdYTD, dept.orcamentosQtdLY)
                          const convChange = calcChange(dept.taxaConversaoYTD, dept.taxaConversaoLY)

                          const ChangeIndicator = ({ 
                            change, 
                            previousValue, 
                            formatter = (v: number) => v.toFixed(0)
                          }: { 
                            change: { percent: number; isPositive: boolean }
                            previousValue: number
                            formatter?: (value: number) => string
                          }) => (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs text-muted-foreground">
                                {formatter(previousValue)}
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  change.isPositive ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {change.isPositive ? '▲' : '▼'} {Math.abs(change.percent).toFixed(1)}%
                              </span>
                            </div>
                          )

                          return (
                            <TableRow key={dept.department}>
                              <TableCell className="font-medium">{dept.department}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{currency(dept.faturacaoYTD)}</span>
                                  <ChangeIndicator 
                                    change={faturacaoChange} 
                                    previousValue={dept.faturacaoLY}
                                    formatter={currency}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{currency(dept.notasYTD)}</span>
                                  <ChangeIndicator 
                                    change={notasChange} 
                                    previousValue={dept.notasLY}
                                    formatter={currency}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="font-semibold">{currency(dept.receitaLiquidaYTD)}</span>
                                  <ChangeIndicator 
                                    change={receitaChange} 
                                    previousValue={dept.receitaLiquidaLY}
                                    formatter={currency}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{dept.nrFaturasYTD.toFixed(0)}</span>
                                  <ChangeIndicator 
                                    change={nrFaturasChange} 
                                    previousValue={dept.nrFaturasLY}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{dept.nrNotasYTD.toFixed(0)}</span>
                                  <ChangeIndicator 
                                    change={nrNotasChange} 
                                    previousValue={dept.nrNotasLY}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{currency(dept.ticketMedioYTD)}</span>
                                  <ChangeIndicator 
                                    change={ticketChange} 
                                    previousValue={dept.ticketMedioLY}
                                    formatter={currency}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{currency(dept.orcamentosValorYTD)}</span>
                                  <ChangeIndicator 
                                    change={orcValorChange} 
                                    previousValue={dept.orcamentosValorLY}
                                    formatter={currency}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{dept.orcamentosQtdYTD.toFixed(0)}</span>
                                  <ChangeIndicator 
                                    change={orcQtdChange} 
                                    previousValue={dept.orcamentosQtdLY}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span>{percent(dept.taxaConversaoYTD)}</span>
                                  <ChangeIndicator 
                                    change={convChange} 
                                    previousValue={dept.taxaConversaoLY}
                                    formatter={percent}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          const newExpanded = new Set(expandedRows)
                                          if (isExpanded) {
                                            newExpanded.delete(dept.department)
                                          } else {
                                            newExpanded.add(dept.department)
                                          }
                                          setExpandedRows(newExpanded)
                                        }}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {isExpanded ? 'Ocultar' : 'Detalhes'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        
                        {/* TOTAL ROW */}
                        {totalsData && (
                          <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
                            <TableCell className="font-bold text-lg">TOTAL</TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold">{currency(totalsData.faturacaoYTD)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {currency(totalsData.faturacaoLY)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold">{currency(totalsData.notasYTD)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {currency(totalsData.notasLY)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold text-lg">{currency(totalsData.receitaLiquidaYTD)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {currency(totalsData.receitaLiquidaLY)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold">{totalsData.nrFaturasYTD.toFixed(0)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {totalsData.nrFaturasLY.toFixed(0)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold">{totalsData.nrNotasYTD.toFixed(0)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {totalsData.nrNotasLY.toFixed(0)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold">{currency(totalsData.ticketMedioYTD)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {currency(totalsData.ticketMedioLY)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold">{currency(totalsData.orcamentosValorYTD)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {currency(totalsData.orcamentosValorLY)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold">{totalsData.orcamentosQtdYTD.toFixed(0)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {totalsData.orcamentosQtdLY.toFixed(0)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold">{percent(totalsData.taxaConversaoYTD)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {percent(totalsData.taxaConversaoLY)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {/* No action button for totals */}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    <p>Nenhum dado disponível para ranking de departamentos</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evolução Anual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  <p>
                    Gráficos em desenvolvimento - Integração com Recharts em breve
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análise Mensal {currentYear}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  <p>
                    Gráficos em desenvolvimento - Integração com Recharts em breve
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taxa de Conversão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  <p>
                    Gráficos em desenvolvimento - Integração com Recharts em breve
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

