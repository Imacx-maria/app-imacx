/**
 * 🧪 TEMPORARY MOCK ETL ENDPOINT FOR TESTING
 * 
 * This endpoint simulates ETL sync responses for testing the sync buttons
 * in Faturação and Produção pages.
 * 
 * ⚠️ DELETE THIS FILE AFTER TESTING - IT'S NOT NEEDED IN PRODUCTION
 * 
 * To use:
 * 1. Temporarily modify button handlers to call /api/test/etl-mock
 * 2. Test button functionality
 * 3. Revert changes and delete this file
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // Parse request body to check for sync type
    const body = await req.json().catch(() => ({}))
    const syncType = body.type || 'full'

    // Simulate processing delay (1-3 seconds)
    const delay = Math.floor(Math.random() * 2000) + 1000
    await new Promise(resolve => setTimeout(resolve, delay))

    // Simulate realistic ETL response
    const mockResponse = {
      success: true,
      message: `Mock ${syncType} ETL sync completed successfully`,
      data: {
        syncType,
        timestamp: new Date().toISOString(),
        recordsProcessed: Math.floor(Math.random() * 100) + 50,
        recordsUpdated: Math.floor(Math.random() * 50) + 10,
        recordsCreated: Math.floor(Math.random() * 20) + 5,
        recordsSkipped: Math.floor(Math.random() * 10),
        duration: `${delay}ms`,
        tables: {
          folhas_obras: Math.floor(Math.random() * 30) + 10,
          items_base: Math.floor(Math.random() * 50) + 20,
          clientes: Math.floor(Math.random() * 15) + 5,
          logistica_entregas: Math.floor(Math.random() * 40) + 15,
        },
      },
    }

    console.log('🧪 Mock ETL Response:', mockResponse)

    return NextResponse.json(mockResponse, { status: 200 })
  } catch (error) {
    console.error('Mock ETL error:', error)
    return NextResponse.json(
      {
        error: 'Mock ETL sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

