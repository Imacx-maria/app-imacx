import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/designer-analytics/revisions
 *
 * Returns revision metrics (R1-R6)
 * Tracks rejection rates and revision patterns
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
    const { data, error } = await supabase.rpc('get_revision_metrics', {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    })

    if (error) {
      console.error('❌ [Designer Revisions] RPC Error:', error)
      return NextResponse.json(
        { error: `Failed to fetch revision metrics: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data?.[0] || {
        total_items: 0,
        items_with_revisions: 0,
        revision_rate: 0,
        r1_count: 0,
        r2_count: 0,
        r3_count: 0,
        r4_count: 0,
        r5_count: 0,
        r6_count: 0,
        avg_revisions_per_item: 0,
      },
      metadata: {
        period,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('❌ [Designer Revisions] Unexpected Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch revision metrics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
