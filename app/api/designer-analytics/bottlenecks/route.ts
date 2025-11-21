import { createServerClient } from '@/utils/supabase'
import { createAdminClient } from '@/utils/supabaseAdmin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/designer-analytics/bottlenecks
 *
 * Returns items stuck in workflow (>N days without progress)
 * Used to identify bottlenecks and delayed items
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
  const daysThreshold = parseInt(searchParams.get('days_threshold') || '7', 10)

  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase.rpc('get_bottleneck_items', {
      days_threshold: daysThreshold,
    })

    if (error) {
      console.error('❌ [Designer Bottlenecks] RPC Error:', error)
      return NextResponse.json(
        { error: `Failed to fetch bottleneck items: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data || [],
      metadata: {
        days_threshold: daysThreshold,
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('❌ [Designer Bottlenecks] Unexpected Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch bottleneck items',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
