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
  const daysThreshold = parseInt(searchParams.get('days_threshold') || '30')

  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase.rpc('get_production_bottlenecks', {
      days_threshold: daysThreshold,
    })

    if (error) {
      console.error('❌ [Production Bottlenecks] RPC Error:', error)
      return NextResponse.json(
        { error: `Failed to fetch bottlenecks: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('❌ [Production Bottlenecks] Unexpected Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch bottlenecks',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
