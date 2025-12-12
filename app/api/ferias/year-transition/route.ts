import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabaseAdmin'

export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute should be plenty

/**
 * Vacation Year Transition API
 *
 * Executes the year-end vacation balance carryover:
 * - Calculates new previous_year_balance (capped at 20)
 * - Resets current_year_total based on new year entitlements
 * - Sets current_year_used based on any pre-registered vacations
 *
 * This endpoint is idempotent - running it multiple times for the same year
 * will not cause duplicate transitions.
 *
 * Authentication: Bearer token matching CRON_SECRET env var
 *
 * POST /api/ferias/year-transition
 * Body (optional): { "targetYear": 2026 }
 *
 * If targetYear is not provided, defaults to current year.
 */
export async function POST(req: NextRequest) {
  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error', code: 'CONFIG_ERROR' },
        { status: 500 }
      )
    }

    // Check bearer token
    const expectedAuth = `Bearer ${cronSecret}`
    if (authHeader !== expectedAuth) {
      console.warn('Unauthorized year-transition attempt')
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Parse optional body for target year
    let targetYear: number | null = null
    try {
      const body = await req.json().catch(() => ({}))
      if (body.targetYear && typeof body.targetYear === 'number') {
        targetYear = body.targetYear
      }
    } catch {
      // No body or invalid JSON is fine, we'll use default
    }

    // Create admin client (bypasses RLS)
    const supabase = createAdminClient()

    // Call the idempotent wrapper function
    const { data, error } = await supabase.rpc('run_vacation_year_transition_if_needed', {
      p_target_year: targetYear,
    })

    if (error) {
      console.error('Year transition RPC error:', error)
      return NextResponse.json(
        {
          error: 'Database error',
          code: 'DB_ERROR',
          details: error.message
        },
        { status: 500 }
      )
    }

    // The RPC returns a single row with status info
    const result = Array.isArray(data) ? data[0] : data

    if (!result) {
      return NextResponse.json(
        { error: 'No result from transition function', code: 'NO_RESULT' },
        { status: 500 }
      )
    }

    // Log the result
    console.log(`Year transition result for ${result.target_year}:`, {
      status: result.status,
      already_run: result.already_run,
      employees_updated: result.employees_updated,
    })

    // Return appropriate response based on status
    const httpStatus = result.status === 'success' ? 200 :
                       result.status === 'skipped' ? 200 :
                       result.status === 'locked' ? 409 : 200

    return NextResponse.json(
      {
        success: result.status === 'success' || result.status === 'skipped',
        status: result.status,
        targetYear: result.target_year,
        alreadyRun: result.already_run,
        employeesUpdated: result.employees_updated,
        details: result.details,
      },
      { status: httpStatus }
    )

  } catch (error) {
    console.error('Year transition error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ferias/year-transition
 *
 * Returns the status of year transitions (which years have been run).
 * Requires the same CRON_SECRET authorization.
 */
export async function GET(req: NextRequest) {
  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Server configuration error', code: 'CONFIG_ERROR' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('vacation_year_transition_runs')
      .select('*')
      .order('target_year', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      runs: data,
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
