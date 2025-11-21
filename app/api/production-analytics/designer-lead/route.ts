import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
  const groupBy = searchParams.get('group_by') || 'complexity'

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  let startDate: Date
  let endDate: Date = now

  if (period === 'mtd') {
    startDate = new Date(currentYear, currentMonth, 1)
  } else {
    startDate = new Date(currentYear, 0, 1)
  }

  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase.rpc('get_production_designer_lead_time', {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      group_by: groupBy,
    })

    if (error) {
      console.error('❌ [Production Designer Lead] RPC Error:', error)
      return NextResponse.json(
        { error: `Failed to fetch designer lead time: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('❌ [Production Designer Lead] Unexpected Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch designer lead time',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
