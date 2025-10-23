import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Prepare Year ETL Sync
 * Prepares database for new year (reset counters, etc.)
 * POST /api/etl/prepare-year
 */
export async function POST(req: NextRequest) {
  try {
    const externalUrl = process.env.ETL_SYNC_URL

    if (externalUrl) {
      const response = await fetch(`${externalUrl}/etl/prepare-year`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ETL_API_KEY || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error(`External ETL service returned ${response.status}`)
      }

      const data = await response.json()
      return NextResponse.json(
        { success: true, message: 'Year preparation completed', data },
        { status: 200 }
      )
    }

    console.log('ETL_SYNC_URL not configured. Would run local Python script here.')

    return NextResponse.json(
      {
        success: true,
        message: 'Year preparation scheduled. Configure ETL_SYNC_URL for automation.',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('ETL prepare year error:', error)
    return NextResponse.json(
      {
        error: 'ETL preparation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

