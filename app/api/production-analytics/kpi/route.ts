import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/production-analytics/kpi
 *
 * Returns KPI metrics for production performance:
 * - Total jobs entered
 * - Completed jobs count
 * - Completion rate percentage
 * - Average cycle time (days)
 * - Total value completed
 * - Jobs without logistics/value
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
    console.error('❌ [Production KPI] Authentication failed:', authError)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('✅ [Production KPI] User authenticated:', user.email)

  // Step 2: Extract query parameters
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'ytd' // 'mtd' | 'ytd'

  console.log('📊 [Production KPI] Query params:', { period })

  // Step 3: Calculate date ranges based on period
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-based

  let startDate: Date
  let endDate: Date = now

  if (period === 'mtd') {
    // Month-to-Date: From 1st of current month to today
    startDate = new Date(currentYear, currentMonth, 1)
  } else {
    // YTD: From Jan 1 to today
    startDate = new Date(currentYear, 0, 1)
  }

  console.log('📊 [Production KPI] Date range:', {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  })

  // Step 4: Use admin client for database queries
  const supabase = createAdminClient()

  try {
    // Call the RPC function
    const { data, error } = await supabase.rpc('get_production_kpis', {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    })

    if (error) {
      console.error('❌ [Production KPI] RPC Error:', error)
      return NextResponse.json(
        { error: `Failed to fetch KPIs: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('✅ [Production KPI] Data fetched successfully:', data?.[0])

    // Extract metrics from RPC result
    const kpis = data?.[0] || {
      total_jobs: 0,
      completed_jobs: 0,
      completion_rate: 0,
      avg_cycle_days: 0,
      total_value_completed: 0,
      jobs_without_logistics: 0,
      jobs_without_value: 0,
    }

    const response = {
      total_jobs: Number(kpis.total_jobs),
      completed_jobs: Number(kpis.completed_jobs),
      completion_rate: Number(kpis.completion_rate || 0),
      avg_cycle_days: Number(kpis.avg_cycle_days || 0),
      total_value_completed: Number(kpis.total_value_completed || 0),
      jobs_without_logistics: Number(kpis.jobs_without_logistics),
      jobs_without_value: Number(kpis.jobs_without_value),
      metadata: {
        period,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ [Production KPI] Unexpected Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch production KPIs',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
