import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/designer-analytics/cycle-times
 *
 * Returns average cycle times (entrada → saida)
 * Grouped by: month, designer, or complexity
 * Used for Chart 3 & 4
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
  const groupBy = searchParams.get('group_by') || 'month' // 'month' | 'designer' | 'complexity'
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
    const { data, error } = await supabase.rpc('get_designer_cycle_times', {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      group_by: groupBy,
    })

    if (error) {
      console.error('❌ [Designer Cycle Times] RPC Error:', error)
      return NextResponse.json(
        { error: `Failed to fetch cycle times: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data || [],
      metadata: {
        period,
        group_by: groupBy,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('❌ [Designer Cycle Times] Unexpected Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch cycle times',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
