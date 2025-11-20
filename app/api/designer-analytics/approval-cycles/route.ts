import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/designer-analytics/approval-cycles
 *
 * Returns approval cycle metrics (M1→A1 through M6→A6)
 * Tracks how many iterations items go through
 */
export async function GET(request: Request) {
  const cookieStore = cookies()
  const authClient = await createServerClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'ytd'
  const customStartDate = searchParams.get('start_date')
  const customEndDate = searchParams.get('end_date')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  let startDate: Date
  let endDate: Date = now

  if (period === 'custom' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate)
    endDate = new Date(customEndDate)
  } else if (period === 'mtd') {
    startDate = new Date(currentYear, currentMonth, 1)
  } else {
    startDate = new Date(currentYear, 0, 1)
  }

  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase.rpc('get_approval_cycle_metrics', {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    })

    if (error) {
      console.error('❌ [Designer Approval Cycles] RPC Error:', error)
      return NextResponse.json(
        { error: `Failed to fetch approval cycle metrics: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data?.[0] || {
        avg_cycles: 0,
        first_time_approval_rate: 0,
        items_with_1_cycle: 0,
        items_with_2_cycles: 0,
        items_with_3_cycles: 0,
        items_with_4_cycles: 0,
        items_with_5_cycles: 0,
        items_with_6_cycles: 0,
        total_items: 0,
      },
      metadata: {
        period,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('❌ [Designer Approval Cycles] Unexpected Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch approval cycle metrics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
