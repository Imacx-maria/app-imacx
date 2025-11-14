import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Step 1: Authenticate with server client
  const cookieStore = cookies()
  const authClient = await createServerClient(cookieStore)

  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 2: Query with admin client
  const supabase = createAdminClient()

  try {
    // Calculate date ranges
    const now = new Date()
    const currentYear = now.getFullYear()
    const previousYear = currentYear - 1

    // Current YTD: Jan 1 to today (current year)
    const currentYtdStart = new Date(currentYear, 0, 1)
    const currentYtdEnd = now

    // Previous YTD: Same calendar period last year
    const previousYtdStart = new Date(previousYear, 0, 1)
    const previousYtdEnd = new Date(previousYear, now.getMonth(), now.getDate())

    console.log('📊 Cost Center Analysis - Date Ranges:')
    console.log('Current YTD:', currentYtdStart.toISOString().split('T')[0], 'to', currentYtdEnd.toISOString().split('T')[0])
    console.log('Previous YTD:', previousYtdStart.toISOString().split('T')[0], 'to', previousYtdEnd.toISOString().split('T')[0])

    // Fetch current year summary
    const { data: currentSummary, error: currentError } = await supabase.rpc('get_cost_center_summary', {
      start_date: currentYtdStart.toISOString().split('T')[0],
      end_date: currentYtdEnd.toISOString().split('T')[0],
      source_table: 'ft'
    })

    if (currentError) {
      console.error('❌ Current summary error:', currentError)
      return NextResponse.json({ error: currentError.message }, { status: 500 })
    }

    // Fetch previous year summary (2-year historical table)
    const { data: previousSummary, error: previousError } = await supabase.rpc('get_cost_center_summary', {
      start_date: previousYtdStart.toISOString().split('T')[0],
      end_date: previousYtdEnd.toISOString().split('T')[0],
      source_table: '2years_ft'
    })

    if (previousError) {
      console.error('❌ Previous summary error:', previousError)
      return NextResponse.json({ error: previousError.message }, { status: 500 })
    }

    // Fetch quarterly trends for current year
    const { data: quarterlyTrends, error: quarterlyError } = await supabase.rpc('get_cost_center_quarterly', {
      start_date: currentYtdStart.toISOString().split('T')[0],
      end_date: currentYtdEnd.toISOString().split('T')[0],
      source_table: 'ft'
    })

    if (quarterlyError) {
      console.error('❌ Quarterly trends error:', quarterlyError)
      return NextResponse.json({ error: quarterlyError.message }, { status: 500 })
    }

    // Fetch monthly trends for current year
    const { data: monthlyTrends, error: monthlyError } = await supabase.rpc('get_cost_center_monthly', {
      start_date: currentYtdStart.toISOString().split('T')[0],
      end_date: currentYtdEnd.toISOString().split('T')[0],
      source_table: 'ft'
    })

    if (monthlyError) {
      console.error('❌ Monthly trends error:', monthlyError)
      return NextResponse.json({ error: monthlyError.message }, { status: 500 })
    }

    // Fetch previous year quarterly for comparison
    const { data: previousQuarterly, error: prevQuarterlyError } = await supabase.rpc('get_cost_center_quarterly', {
      start_date: previousYtdStart.toISOString().split('T')[0],
      end_date: previousYtdEnd.toISOString().split('T')[0],
      source_table: '2years_ft'
    })

    if (prevQuarterlyError) {
      console.error('❌ Previous quarterly error:', prevQuarterlyError)
      // Don't fail the request, just continue without comparison
      console.warn('⚠️ Continuing without previous year quarterly data')
    }

    // Calculate YTD comparisons
    const comparisonData = (currentSummary || []).map((current: any) => {
      const previous = (previousSummary || []).find(
        (p: any) => p.cost_center === current.cost_center
      )

      const currentRevenue = parseFloat(current.total_revenue) || 0
      const previousRevenue = previous ? parseFloat(previous.total_revenue) || 0 : 0
      const revenueDiff = currentRevenue - previousRevenue
      const revenueGrowth = previousRevenue > 0 ? (revenueDiff / previousRevenue) * 100 : 0

      return {
        cost_center: current.cost_center,
        current_year: {
          total_revenue: currentRevenue,
          total_invoices: parseInt(current.total_invoices) || 0,
          unique_customers: parseInt(current.unique_customers) || 0,
          pct_of_total: parseFloat(current.pct_of_total) || 0
        },
        previous_year: {
          total_revenue: previousRevenue,
          total_invoices: previous ? parseInt(previous.total_invoices) || 0 : 0,
          unique_customers: previous ? parseInt(previous.unique_customers) || 0 : 0,
          pct_of_total: previous ? parseFloat(previous.pct_of_total) || 0 : 0
        },
        comparison: {
          revenue_diff: revenueDiff,
          revenue_growth_pct: revenueGrowth,
          invoice_diff: (parseInt(current.total_invoices) || 0) - (previous ? parseInt(previous.total_invoices) || 0 : 0),
          customer_diff: (parseInt(current.unique_customers) || 0) - (previous ? parseInt(previous.unique_customers) || 0 : 0),
          pct_point_diff: (parseFloat(current.pct_of_total) || 0) - (previous ? parseFloat(previous.pct_of_total) || 0 : 0)
        }
      }
    })

    // Sort by current year revenue
    comparisonData.sort((a: any, b: any) => b.current_year.total_revenue - a.current_year.total_revenue)

    // Calculate totals
    const currentTotal = comparisonData.reduce((sum: number, item: any) => sum + item.current_year.total_revenue, 0)
    const previousTotal = comparisonData.reduce((sum: number, item: any) => sum + item.previous_year.total_revenue, 0)

    // Process quarterly trends for chart visualization
    const quarterlyByCenter = (quarterlyTrends || []).reduce((acc: any, row: any) => {
      const center = row.cost_center
      if (!acc[center]) {
        acc[center] = []
      }
      acc[center].push({
        quarter: row.quarter,
        revenue: parseFloat(row.revenue) || 0,
        invoice_count: parseInt(row.invoice_count) || 0,
        avg_invoice_value: parseFloat(row.avg_invoice_value) || 0
      })
      return acc
    }, {})

    // Process monthly trends for detailed analysis
    const monthlyByCenter = (monthlyTrends || []).reduce((acc: any, row: any) => {
      const center = row.cost_center
      if (!acc[center]) {
        acc[center] = []
      }
      acc[center].push({
        month: row.month,
        revenue: parseFloat(row.revenue) || 0,
        invoice_count: parseInt(row.invoice_count) || 0
      })
      return acc
    }, {})

    console.log(`✅ Processed ${comparisonData.length} cost centers`)
    console.log(`💰 Current YTD Total: €${currentTotal.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`)
    console.log(`📈 Growth: ${((currentTotal - previousTotal) / previousTotal * 100).toFixed(2)}%`)

    return NextResponse.json({
      cost_centers: comparisonData,
      quarterly_trends: quarterlyByCenter,
      monthly_trends: monthlyByCenter,
      previous_quarterly: previousQuarterly || [],
      summary: {
        total_current_revenue: currentTotal,
        total_previous_revenue: previousTotal,
        total_growth_pct: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0,
        total_cost_centers: comparisonData.length,
        total_current_invoices: comparisonData.reduce((sum: number, item: any) => sum + item.current_year.total_invoices, 0),
        total_previous_invoices: comparisonData.reduce((sum: number, item: any) => sum + item.previous_year.total_invoices, 0),
        top_3_centers: comparisonData.slice(0, 3).map((item: any) => ({
          cost_center: item.cost_center,
          revenue: item.current_year.total_revenue,
          pct_of_total: item.current_year.pct_of_total
        }))
      },
      metadata: {
        current_period: {
          start: currentYtdStart.toISOString().split('T')[0],
          end: currentYtdEnd.toISOString().split('T')[0],
          year: currentYear
        },
        previous_period: {
          start: previousYtdStart.toISOString().split('T')[0],
          end: previousYtdEnd.toISOString().split('T')[0],
          year: previousYear
        },
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Unexpected error in cost-center:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
