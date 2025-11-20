import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/designer-analytics/kpi
 *
 * Returns KPI metrics for designer performance:
 * - Total items (entered workflow)
 * - Completed items (data_saida not null)
 * - In progress items (no data_saida, paginacao = false)
 * - Average cycle days (entrada → saida)
 * - First-time approval rate
 * - Revision rate
 * - Bottleneck items (stuck > 7 days)
 */
export async function GET(request: Request) {
  // Step 1: Validate authentication
  const cookieStore = cookies()
  const authClient = await createServerClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    console.error('❌ [Designer KPI] Authentication failed:', authError)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('✅ [Designer KPI] User authenticated:', user.email)

  // Step 2: Extract query parameters
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'ytd' // 'mtd' | 'ytd' | 'custom'
  const customStartDate = searchParams.get('start_date')
  const customEndDate = searchParams.get('end_date')

  console.log('📊 [Designer KPI] Query params:', { period, customStartDate, customEndDate })

  // Step 3: Calculate date ranges based on period
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-based

  let startDate: Date
  let endDate: Date = now

  if (period === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate)
    endDate = new Date(customEndDate)
  } else if (period === 'mtd') {
    // Month-to-Date: From 1st of current month to today
    startDate = new Date(currentYear, currentMonth, 1)
  } else {
    // YTD: From Jan 1 to today
    startDate = new Date(currentYear, 0, 1)
  }

  console.log('📊 [Designer KPI] Date range:', {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  })

  // Step 4: Use admin client for database queries
  const supabase = createAdminClient()

  try {
    // Call the RPC function
    const { data, error } = await supabase.rpc('get_designer_kpis', {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    })

    if (error) {
      console.error('❌ [Designer KPI] RPC Error:', error)
      return NextResponse.json(
        { error: `Failed to fetch KPIs: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('✅ [Designer KPI] Data fetched successfully:', data?.[0])

    // Extract metrics from RPC result
    const kpis = data?.[0] || {
      total_items: 0,
      completed_items: 0,
      in_progress_items: 0,
      avg_cycle_days: 0,
      first_time_approval_rate: 0,
      revision_rate: 0,
      bottleneck_items: 0,
    }

    // Calculate completion rate
    const completionRate = kpis.total_items > 0
      ? Math.round((kpis.completed_items / kpis.total_items) * 100 * 100) / 100
      : 0

    const response = {
      total_items: Number(kpis.total_items),
      completed_items: Number(kpis.completed_items),
      in_progress_items: Number(kpis.in_progress_items),
      avg_cycle_days: Number(kpis.avg_cycle_days || 0),
      completion_rate: completionRate,
      first_time_approval_rate: Number(kpis.first_time_approval_rate || 0),
      revision_rate: Number(kpis.revision_rate || 0),
      bottleneck_items: Number(kpis.bottleneck_items),
      metadata: {
        period,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ [Designer KPI] Unexpected Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch designer KPIs',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
