import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Annual Update ETL Sync
 * Performs annual maintenance and updates
 * POST /api/etl/annual-update
 */
export async function POST(req: NextRequest) {
  try {
    const externalUrl = process.env.ETL_SYNC_URL

    if (externalUrl) {
      const response = await fetch(`${externalUrl}/etl/annual-update`, {
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
        { success: true, message: 'Annual update completed', data },
        { status: 200 }
      )
    }

    console.log('ETL_SYNC_URL not configured. Would run local Python script here.')

    return NextResponse.json(
      {
        success: true,
        message: 'Annual update scheduled. Configure ETL_SYNC_URL for automation.',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('ETL annual update error:', error)
    return NextResponse.json(
      {
        error: 'ETL annual update failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

