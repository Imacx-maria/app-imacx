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
  revenueCards2: MetricCard[]
  quotesCards: MetricCard[]
  quotesCards2: MetricCard[]
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
}: {
  title: string
  cards: MetricCard[]
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
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
      // Fetch data from PHC schema tables
      const currentMonth = new Date().getMonth() + 1

      // Helper to normalize document types
      const normalizeDocType = (value: string | null | undefined): string => {
        if (!value) return ''
        const normalized = value.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
        if (normalized.includes('nota') && normalized.includes('credito')) return 'nota_de_credito'
        if (normalized.includes('guia') && normalized.includes('transporte')) return 'guia_de_transporte'
        if (normalized.includes('factura') || normalized.includes('fatura')) return 'factura'
        if (normalized.includes('orcamento')) return 'orcamento'
        return normalized
      }

      // Fetch historical invoice data (previous year) - using salesperson table as per data flow
      const { data: ftHistoricalData, error: ftHistError } = await supabase
        .schema('phc')
        .from('ft_historical_monthly_salesperson')
        .select('year, month, document_type, total_value, document_count')
        .eq('year', previousYear)
        .lte('month', currentMonth)
        .order('year', { ascending: true })
        .order('month', { ascending: true })

      // Fetch current year invoices - using view as per data flow
      const { data: currentYearInvoices, error: ftCurrentError } = await supabase
        .schema('phc')
        .from('v_ft_current_year_monthly_salesperson')
        .select('year, month, document_type, total_value, document_count')
        .order('month', { ascending: true })

      // Fetch historical quotes data (previous year) - using salesperson table as per data flow
      const { data: boHistoricalData, error: boHistError } = await supabase
        .schema('phc')
        .from('bo_historical_monthly_salesperson')
        .select('year, month, document_type, total_value, document_count')
        .eq('year', previousYear)
        .lte('month', currentMonth)
        .order('year', { ascending: true })
        .order('month', { ascending: true })

      // Fetch current year quotes - using view as per data flow
      const { data: currentYearQuotes, error: boCurrentError } = await supabase
        .schema('phc')
        .from('v_bo_current_year_monthly_salesperson')
        .select('year, month, document_type, total_value, document_count')
        .order('month', { ascending: true })

      if (ftHistError) throw ftHistError
      if (ftCurrentError) throw ftCurrentError
      if (boHistError) throw boHistError
      if (boCurrentError) throw boCurrentError
      
      // Debug logging for overview cards data
      console.log('💳 Overview Cards Data Fetch:')
      console.log('  ftHistoricalData (2024):', ftHistoricalData?.length || 0, 'rows')
      console.log('  currentYearInvoices (2025):', currentYearInvoices?.length || 0, 'rows')
      console.log('  boHistoricalData (2024):', boHistoricalData?.length || 0, 'rows')
      console.log('  currentYearQuotes (2025):', currentYearQuotes?.length || 0, 'rows')
      
      if (ftHistoricalData && ftHistoricalData.length > 0) {
        console.log('  Sample ftHistoricalData:', ftHistoricalData[0])
      }
      if (currentYearInvoices && currentYearInvoices.length > 0) {
        console.log('  Sample currentYearInvoices:', currentYearInvoices[0])
      }

      // Calculate metrics for a specific year
      const calculateYearMetrics = (year: number) => {
        let faturasValue = 0
        let faturasCount = 0
        let notasValue = 0
        let notasCount = 0
        let orcamentosValue = 0
        let orcamentosCount = 0

        if (year < currentYear) {
          // Use historical monthly data for previous years
          if (ftHistoricalData) {
            ftHistoricalData.forEach((row: any) => {
              const rowYear = Number(row.year)
              if (rowYear !== year) return
              const docType = normalizeDocType(row.document_type)
              
              if (docType === 'factura') {
                faturasValue += Number(row.total_value || 0)
                faturasCount += Number(row.document_count || 0)
              } else if (docType === 'nota_de_credito') {
                notasValue += Math.abs(Number(row.total_value || 0))
                notasCount += Number(row.document_count || 0)
              }
            })
          }

          if (boHistoricalData) {
            boHistoricalData.forEach((row: any) => {
              const rowYear = Number(row.year)
              if (rowYear !== year) return
              const docType = normalizeDocType(row.document_type)
              
              if (docType === 'orcamento') {
                orcamentosValue += Number(row.total_value || 0)
                orcamentosCount += Number(row.document_count || 0)
              }
            })
          }
        } else {
          // Use current year data from views (aggregated monthly)
          if (currentYearInvoices) {
            currentYearInvoices.forEach((row: any) => {
              const docType = normalizeDocType(row.document_type)
              
              if (docType === 'factura') {
                faturasValue += Number(row.total_value || 0)
                faturasCount += Number(row.document_count || 0)
              } else if (docType === 'nota_de_credito') {
                notasValue += Math.abs(Number(row.total_value || 0))
                notasCount += Number(row.document_count || 0)
              }
            })
          }

          if (currentYearQuotes) {
            currentYearQuotes.forEach((row: any) => {
              const docType = normalizeDocType(row.document_type)
              
              if (docType === 'orcamento') {
                orcamentosValue += Number(row.total_value || 0)
                orcamentosCount += Number(row.document_count || 0)
              }
            })
          }
        }

        const netRevenue = faturasValue - notasValue
        const avgFactura = faturasCount > 0 ? faturasValue / faturasCount : 0
        const conversion = orcamentosCount > 0 ? (faturasCount / orcamentosCount) * 100 : 0
        const avgOrcamento = orcamentosCount > 0 ? orcamentosValue / orcamentosCount : 0

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
          avgOrcamento,
        }
      }

      const metricsCurrentYear = calculateYearMetrics(currentYear)
      const metricsPreviousYear = calculateYearMetrics(previousYear)
      
      // Debug: Log calculated metrics
      console.log('📊 Calculated Metrics:')
      console.log('  Current Year (2025):', metricsCurrentYear)
      console.log('  Previous Year (2024):', metricsPreviousYear)

      // Build cards
      const revenueCards: MetricCard[] = [
        {
          title: `Facturação YTD ${currentYear}`,
          currentValue: metricsCurrentYear.faturasValue,
          previousValue: metricsPreviousYear.faturasValue,
          formatter: currency,
          subtitle: `vs ${previousYear}`,
          colorClass: 'text-emerald-600',
        },
        {
          title: `Notas Crédito YTD ${currentYear}`,
          currentValue: metricsCurrentYear.notasValue,
          previousValue: metricsPreviousYear.notasValue,
          formatter: currency,
          subtitle: `vs ${previousYear}`,
          colorClass: 'text-orange-600',
        },
        {
          title: `Receita Líquida YTD ${currentYear}`,
          currentValue: metricsCurrentYear.netRevenue,
          previousValue: metricsPreviousYear.netRevenue,
          formatter: currency,
          subtitle: `vs ${previousYear}`,
          colorClass: 'text-blue-600',
        },
      ]

      const revenueCards2: MetricCard[] = [
        {
          title: `Nº Faturas ${currentYear}`,
          currentValue: metricsCurrentYear.faturasCount,
          previousValue: metricsPreviousYear.faturasCount,
          subtitle: `vs ${previousYear}`,
        },
        {
          title: `Nº Notas Crédito ${currentYear}`,
          currentValue: metricsCurrentYear.notasCount,
          previousValue: metricsPreviousYear.notasCount,
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

      const quotesCards2: MetricCard[] = [
        {
          title: `Valor Médio Orçamento ${currentYear}`,
          currentValue: metricsCurrentYear.avgOrcamento,
          previousValue: metricsPreviousYear.avgOrcamento,
          formatter: currency,
          subtitle: `vs ${previousYear}`,
        },
        {
          title: `Orçamentos/Mês ${currentYear}`,
          currentValue: metricsCurrentYear.orcamentosCount / currentMonth,
          previousValue: metricsPreviousYear.orcamentosCount / currentMonth,
          subtitle: `vs ${previousYear}`,
        },
        {
          title: `Faturas/Orçamentos ${currentYear}`,
          currentValue: metricsCurrentYear.conversion,
          previousValue: metricsPreviousYear.conversion,
          formatter: percent,
          subtitle: `vs ${previousYear}`,
        },
      ]

      setData({
        revenueCards,
        revenueCards2,
        quotesCards,
        quotesCards2,
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
      const currentMonth = new Date().getMonth() + 1 // Current system month (1-12)
      
      // Helper function to normalize document types for consistent matching
      const normalizeDocumentType = (docType: string | null | undefined): string => {
        if (!docType) return ''
        const normalized = docType
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // strip accents
          .trim()
        // Map common PHC labels
        if (normalized.includes('factur') || normalized.includes('fatur')) return 'factura'
        if (normalized.includes('nota') && normalized.includes('credito')) return 'nota_de_credito'
        if (normalized.includes('orcamento')) return 'orcamento'
        return normalized
      }
      
      const normalizeDepartmentName = (name: string | null | undefined): string => {
        if (!name) return 'UNKNOWN'
        const norm = name
          .toString()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toUpperCase()
        // Merge common aliases by contains rules
        if (norm.includes('IMACX')) return 'IMACX'
        if (norm.includes('DIGITA')) return 'DIGITAL'
        if (norm.includes('BRINDE')) return 'BRINDES'
        if (norm.includes('PRODUC')) return 'PRODUCAO'
        if (norm.includes('ADMIN')) return 'ADMIN'
        return norm
      }
      
      // Fetch from 4 tables - all have department field
      const [
        ftHistResult,      // Previous year: Factura + Nota de Crédito
        boHistResult,      // Previous year: Orçamento
        ftCurrentResult,   // Current year: Factura + Nota de Crédito
        boCurrentResult,   // Current year: Orçamento
      ] = await Promise.all([
        // ft_historical_monthly_salesperson: previous year Jan-current month
        supabase
          .schema('phc')
          .from('ft_historical_monthly_salesperson')
          .select('*')
          .eq('year', previousYear)
          .lte('month', currentMonth),
        
        // bo_historical_monthly_salesperson: previous year Jan-current month
        supabase
          .schema('phc')
          .from('bo_historical_monthly_salesperson')
          .select('*')
          .eq('year', previousYear)
          .lte('month', currentMonth),
        
        // v_ft_current_year_monthly_salesperson: current year all months
        supabase
          .schema('phc')
          .from('v_ft_current_year_monthly_salesperson')
          .select('*'),
        
        // v_bo_current_year_monthly_salesperson: current year all months
        supabase
          .schema('phc')
          .from('v_bo_current_year_monthly_salesperson')
          .select('*'),
      ])

      const ftHist = ftHistResult.data || []
      const boHist = boHistResult.data || []
      const ftCurrent = ftCurrentResult.data || []
      const boCurrent = boCurrentResult.data || []
      
      // Debug logging
      console.log('📊 Department Data Fetch Results:')
      console.log('  ft_historical (2024):', ftHist.length, 'rows')
      console.log('  bo_historical (2024):', boHist.length, 'rows')
      console.log('  ft_current (2025):', ftCurrent.length, 'rows')
      console.log('  bo_current (2025):', boCurrent.length, 'rows')
      
      if (ftHist.length > 0) {
        console.log('  Sample ft_historical row:', ftHist[0])
      }
      if (boHist.length > 0) {
        console.log('  Sample bo_historical row:', boHist[0])
      }

      if ((ftHistResult as any).error) {
        console.error('ft_historical_monthly_salesperson select error:', (ftHistResult as any).error)
      }
      if ((boHistResult as any).error) {
        console.error('bo_historical_monthly_salesperson select error:', (boHistResult as any).error)
      }
      if ((ftCurrentResult as any).error) {
        console.error('v_ft_current_year_monthly_salesperson select error:', (ftCurrentResult as any).error)
      }
      if ((boCurrentResult as any).error) {
        console.error('v_bo_current_year_monthly_salesperson select error:', (boCurrentResult as any).error)
      }

      const uniq = (a: any[]) => Array.from(new Set(a.filter(Boolean)))
      console.log('  ftHist years:', uniq(ftHist.map((r: any) => r.year)), 'months:', uniq(ftHist.map((r: any) => r.month)))
      console.log('  ftHist doc types:', uniq(ftHist.map((r: any) => r.document_type)))
      console.log('  boHist years:', uniq(boHist.map((r: any) => r.year)), 'months:', uniq(boHist.map((r: any) => r.month)))
      console.log('  boHist doc types:', uniq(boHist.map((r: any) => r.document_type)))
      console.log('  ftHist departments:', uniq(ftHist.map((r: any) => r.department)))
      console.log('  boHist departments:', uniq(boHist.map((r: any) => r.department)))
      console.log('  mapped departments (sample):', uniq(
        [...ftHist, ...boHist, ...ftCurrent, ...boCurrent]
          .map((r: any) => normalizeDepartmentName(r.department))
      ))
      if (ftHist.length) console.log('  ftHist[0] keys:', Object.keys(ftHist[0] || {}))
      if (boHist.length) console.log('  boHist[0] keys:', Object.keys(boHist[0] || {}))
      if (ftCurrent.length) console.log('  ftCurrent[0] keys:', Object.keys(ftCurrent[0] || {}))
      if (boCurrent.length) console.log('  boCurrent[0] keys:', Object.keys(boCurrent[0] || {}))

      // Quick totals to verify LY aggregation is non-zero
      const lyFtFactura = ftHist
        .filter((r: any) => normalizeDocumentType(r.document_type) === 'factura')
        .reduce((s: number, r: any) => s + Number(r.total_value || 0), 0)
      const lyFtNotas = ftHist
        .filter((r: any) => normalizeDocumentType(r.document_type) === 'nota_de_credito')
        .reduce((s: number, r: any) => s + Math.abs(Number(r.total_value || 0)), 0)
      const lyBoOrc = boHist
        .filter((r: any) => normalizeDocumentType(r.document_type) === 'orcamento')
        .reduce((s: number, r: any) => s + Number(r.total_value || 0), 0)
      console.log('  LY sanity totals — Facturas:', lyFtFactura, 'Notas:', lyFtNotas, 'Orcamentos:', lyBoOrc)

      // Per-department LY summary to cross-check mapping
      const lyByDept = new Map<string, { faturas: number; notas: number; orcamentos: number }>()
      const dep = (n: any) => normalizeDepartmentName(n)
      const ensure = (d: string) => {
        if (!lyByDept.has(d)) lyByDept.set(d, { faturas: 0, notas: 0, orcamentos: 0 })
        return lyByDept.get(d)!
      }
      ftHist.forEach((r: any) => {
        const d = ensure(dep(r.department))
        const dt = normalizeDocumentType(r.document_type)
        if (dt === 'factura') d.faturas += Number(r.total_value || 0)
        if (dt === 'nota_de_credito') d.notas += Math.abs(Number(r.total_value || 0))
      })
      boHist.forEach((r: any) => {
        const d = ensure(dep(r.department))
        const dt = normalizeDocumentType(r.document_type)
        if (dt === 'orcamento') d.orcamentos += Number(r.total_value || 0)
      })
      const lyDeptDump: Record<string, any> = {}
      Array.from(lyByDept.entries()).forEach(([k, v]) => {
        lyDeptDump[k] = v
      })
      console.log('  LY totals by department:', lyDeptDump)

      // Build salesperson -> department map from datasets that include both fields (if present)
      const salespersonToDept = new Map<string, string>()
      const pickDept = (row: any): string | undefined => {
        const candidates = [
          row?.department,
          row?.department_name,
          row?.department_desc,
          row?.department_code,
          row?.departamento,
          row?.dept,
          row?.dept_name,
          row?.seller_department,
          row?.salesperson_department,
        ]
        const val = candidates.find((v) => v && String(v).trim().length)
        return val ? normalizeDepartmentName(val) : undefined
      }
      const pickSalesperson = (row: any): string | undefined => {
        const candidates = [
          row?.salesperson,
          row?.sales_person,
          row?.salesperson_name,
          row?.salesperson_code,
          row?.vendedor,
          row?.seller,
          row?.seller_name,
          row?.seller_code,
        ]
        const val = candidates.find((v) => v && String(v).trim().length)
        return val ? String(val).trim() : undefined
      }
      const mapCurrentRows = [...ftCurrent, ...boCurrent]
      const mapHistoricalRows = [...ftHist, ...boHist]
      mapCurrentRows.forEach((row: any) => {
        const sp = pickSalesperson(row)
        const d = pickDept(row)
        if (sp && d && !salespersonToDept.has(sp)) {
          salespersonToDept.set(sp, d)
        }
      })
      // Only fill missing from historical as a fallback
      mapHistoricalRows.forEach((row: any) => {
        const sp = pickSalesperson(row)
        const d = pickDept(row)
        if (sp && d && !salespersonToDept.has(sp)) {
          salespersonToDept.set(sp, d)
        }
      })
      console.log('  salesperson->dept pairs (sample up to 10):', Array.from(salespersonToDept.entries()).slice(0, 10))

      // Unified extractor used in processing loops
      const KNOWN_DEPTS = new Set(['IMACX', 'DIGITAL', 'BRINDES', 'ADMIN', 'PRODUCAO'])
      const SALES_TO_DEPT_OVERRIDES: Record<string, string> = {
        IMACX: 'IMACX',
        DIGITAL: 'DIGITAL',
      }
      const extractDepartment = (row: any, preferSalesperson = false): string => {
        const sp = pickSalesperson(row)
        const mappedFromSp = sp && salespersonToDept.has(sp) ? salespersonToDept.get(sp)! : undefined
        const rawDept = pickDept(row)
        const normDept = rawDept ? normalizeDepartmentName(rawDept) : undefined
        const spNorm = sp ? normalizeDepartmentName(sp) : undefined
        // Hard overrides by salesperson label
        if (preferSalesperson && spNorm && SALES_TO_DEPT_OVERRIDES[spNorm]) {
          return SALES_TO_DEPT_OVERRIDES[spNorm]
        }

        // For historical rows, prefer salesperson mapping when available
        if (preferSalesperson && mappedFromSp) return mappedFromSp

        // If current value is missing or not recognized, fall back to salesperson map
        if ((!normDept || !KNOWN_DEPTS.has(normDept)) && mappedFromSp) return mappedFromSp

        // Final fallback: default to IMACX as requested
        return normDept || 'IMACX'
      }

      // Aggregate by department
      const deptMap = new Map<string, DepartmentMetrics>()

      const getDept = (name: string): DepartmentMetrics => {
        if (!deptMap.has(name)) {
          deptMap.set(name, {
            department: name,
            faturacaoYTD: 0,
            faturacaoLY: 0,
            notasYTD: 0,
            notasLY: 0,
            receitaLiquidaYTD: 0,
            receitaLiquidaLY: 0,
            nrFaturasYTD: 0,
            nrFaturasLY: 0,
            nrNotasYTD: 0,
            nrNotasLY: 0,
            ticketMedioYTD: 0,
            ticketMedioLY: 0,
            orcamentosValorYTD: 0,
            orcamentosValorLY: 0,
            orcamentosQtdYTD: 0,
            orcamentosQtdLY: 0,
            taxaConversaoYTD: 0,
            taxaConversaoLY: 0,
          })
        }
        return deptMap.get(name)!
      }

      // Process ft_historical_monthly_salesperson (Previous Year: Factura + Nota de Crédito)
      let assignCounts = { histDept: 0, histSP: 0, currDept: 0, currSP: 0 }

      let imacxHistRows = 0
      let imacxHistFactura = 0
      let imacxHistNotas = 0
      ftHist.forEach((row: any) => {
        const sp = pickSalesperson(row)
        const spNorm = sp ? normalizeDepartmentName(sp) : ''
        let extracted = extractDepartment(row, true)
        // Force-map historical IMACX salesperson to IMACX department
        if (spNorm === 'IMACX') {
          extracted = 'IMACX'
          imacxHistRows++
        }
        if (pickDept(row)) assignCounts.histDept++
        else if (pickSalesperson(row)) assignCounts.histSP++
        const dept = getDept(extracted)
        const value = Number(row.total_value || 0)
        const count = Number(row.document_count || 0)
        const docType = normalizeDocumentType(row.document_type)

        if (docType === 'factura') {
          dept.faturacaoLY += value
          dept.nrFaturasLY += count
          if (spNorm === 'IMACX') imacxHistFactura += value
        } else if (docType === 'nota_de_credito') {
          dept.notasLY += Math.abs(value)
          dept.nrNotasLY += count
          if (spNorm === 'IMACX') imacxHistNotas += Math.abs(value)
        }
      })

      // Process bo_historical_monthly_salesperson (Previous Year: Orçamento)
      boHist.forEach((row: any) => {
        const sp = pickSalesperson(row)
        const spNorm = sp ? normalizeDepartmentName(sp) : ''
        let extracted = extractDepartment(row, true)
        if (spNorm === 'IMACX') extracted = 'IMACX'
        if (pickDept(row)) assignCounts.histDept++
        else if (pickSalesperson(row)) assignCounts.histSP++
        const dept = getDept(extracted)
        const value = Number(row.total_value || 0)
        const count = Number(row.document_count || 0)
        const docType = normalizeDocumentType(row.document_type)

        if (docType === 'orcamento') {
          dept.orcamentosValorLY += value
          dept.orcamentosQtdLY += count
        }
      })

      // Process v_ft_current_year_monthly_salesperson (Current Year: Factura + Nota de Crédito)
      ftCurrent.forEach((row: any) => {
        const extracted = extractDepartment(row, false)
        if (pickDept(row)) assignCounts.currDept++
        else if (pickSalesperson(row)) assignCounts.currSP++
        const dept = getDept(extracted)
        const value = Number(row.total_value || 0)
        const count = Number(row.document_count || 0)
        const docType = normalizeDocumentType(row.document_type)

        if (docType === 'factura') {
          dept.faturacaoYTD += value
          dept.nrFaturasYTD += count
        } else if (docType === 'nota_de_credito') {
          dept.notasYTD += Math.abs(value)
          dept.nrNotasYTD += count
        }
      })

      // Process v_bo_current_year_monthly_salesperson (Current Year: Orçamento)
      boCurrent.forEach((row: any) => {
        const extracted = extractDepartment(row, false)
        if (pickDept(row)) assignCounts.currDept++
        else if (pickSalesperson(row)) assignCounts.currSP++
        const dept = getDept(extracted)
        const value = Number(row.total_value || 0)
        const count = Number(row.document_count || 0)
        const docType = normalizeDocumentType(row.document_type)

        if (docType === 'orcamento') {
          dept.orcamentosValorYTD += value
          dept.orcamentosQtdYTD += count
        }
      })

      console.log('  IMACX historical reassignment — rows:', imacxHistRows, 'facturas€:', imacxHistFactura, 'notas€:', imacxHistNotas)

      // If some rows don't carry department but should count for IMACX, merge UNKNOWN -> IMACX
      if (deptMap.has('UNKNOWN')) {
        const unknown = deptMap.get('UNKNOWN')!
        const target = getDept('IMACX')
        target.faturacaoYTD += unknown.faturacaoYTD
        target.faturacaoLY += unknown.faturacaoLY
        target.notasYTD += unknown.notasYTD
        target.notasLY += unknown.notasLY
        target.nrFaturasYTD += unknown.nrFaturasYTD
        target.nrFaturasLY += unknown.nrFaturasLY
        target.nrNotasYTD += unknown.nrNotasYTD
        target.nrNotasLY += unknown.nrNotasLY
        target.ticketMedioYTD += 0 // derived later
        target.ticketMedioLY += 0  // derived later
        target.orcamentosValorYTD += unknown.orcamentosValorYTD
        target.orcamentosValorLY += unknown.orcamentosValorLY
        target.orcamentosQtdYTD += unknown.orcamentosQtdYTD
        target.orcamentosQtdLY += unknown.orcamentosQtdLY
        // Conversion derived later
        deptMap.delete('UNKNOWN')
        console.log('  Merged UNKNOWN department metrics into IMACX')
      }
      console.log('  Department assignment counts:', assignCounts)

      // Calculate derived metrics
      deptMap.forEach((dept) => {
        // Net revenue (receita líquida)
        dept.receitaLiquidaYTD = dept.faturacaoYTD - dept.notasYTD
        dept.receitaLiquidaLY = dept.faturacaoLY - dept.notasLY

        // Average ticket (ticket médio)
        dept.ticketMedioYTD =
          dept.nrFaturasYTD > 0 ? dept.faturacaoYTD / dept.nrFaturasYTD : 0
        dept.ticketMedioLY =
          dept.nrFaturasLY > 0 ? dept.faturacaoLY / dept.nrFaturasLY : 0

        // Conversion rate (taxa de conversão)
        dept.taxaConversaoYTD =
          dept.orcamentosQtdYTD > 0
            ? (dept.nrFaturasYTD / dept.orcamentosQtdYTD) * 100
            : 0
        dept.taxaConversaoLY =
          dept.orcamentosQtdLY > 0
            ? (dept.nrFaturasLY / dept.orcamentosQtdLY) * 100
            : 0
      })

      // Sort by net revenue and set data
      const departments = Array.from(deptMap.values())
        .filter(d => d.department !== 'ADMIN' && d.department !== 'PRODUCAO')
        .sort((a, b) => b.receitaLiquidaYTD - a.receitaLiquidaYTD)
      
      // Debug: Log aggregated department data
      console.log('📈 Aggregated Department Metrics:')
      departments.forEach(dept => {
        console.log(`  ${dept.department}:`, {
          faturacaoLY: dept.faturacaoLY,
          faturacaoYTD: dept.faturacaoYTD,
          notasLY: dept.notasLY,
          notasYTD: dept.notasYTD
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
                      const resp = await fetch('/api/etl/incremental', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'today_all' }),
                      })
                      if (!resp.ok) {
                        const body = await resp.json().catch(() => ({}) as any)
                        console.error('ETL today sync failed', body)
                        alert('Falhou a sincronização (ETL). Verifique logs do servidor.')
                        return
                      }
                      // Refresh data after successful sync
                      await fetchAnalyticsData()
                      await fetchDepartmentRankings()
                    } catch (e) {
                      console.error('Erro ao executar sincronização:', e)
                      alert('Erro ao executar sincronização.')
                    } finally {
                      setIsSyncing(false)
                    }
                  }}
                  variant="outline"
                  size="icon"
                  className="border border-black"
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sincronizar Dados (Hoje)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={fetchAnalyticsData}
                  variant="outline"
                  size="icon"
                  className="border border-black"
                  disabled={loading}
                >
                  <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Atualizar Dados</TooltipContent>
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
              />

              <MetricCardSet
                title={`📊 Contadores ${currentYear} vs ${previousYear}`}
                cards={data.revenueCards2}
              />

              {/* Quotes Cards */}
              <MetricCardSet
                title={`📋 Orçamentos ${currentYear} vs ${previousYear}`}
                cards={data.quotesCards}
              />

              <MetricCardSet
                title={`🎯 Análise Orçamentos ${currentYear} vs ${previousYear}`}
                cards={data.quotesCards2}
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

