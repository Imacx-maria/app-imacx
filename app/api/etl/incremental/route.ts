import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes timeout

/**
 * Incremental ETL Sync
 * Supports different sync types:
 * - default: run_incremental.py (regular incremental)
 * - fast_clients_3days: run_fast_client_sync.py (last 3 days contacts)
 * - fast_bo_bi_only: run_fast_bo_bi_sync.py (BO/BI tables with watermark)
 * POST /api/etl/incremental
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const syncType = body.type || 'default'
    
    const externalUrl = process.env.ETL_SYNC_URL
    const pythonPath = process.env.PYTHON_PATH || 'python'
    const etlScriptsPath = process.env.ETL_SCRIPTS_PATH
    
    // Option 1: Use external ETL service
    if (externalUrl) {
      const response = await fetch(`${externalUrl}/etl/incremental`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ETL_API_KEY || ''}`,
        },
        body: JSON.stringify({ type: syncType }),
      })

      if (!response.ok) {
        throw new Error(`External ETL service returned ${response.status}`)
      }

      const data = await response.json()
      return NextResponse.json(
        { success: true, message: 'Incremental sync completed', data },
        { status: 200 }
      )
    }

    // Option 2: Run local Python ETL script
    if (etlScriptsPath) {
      // Map sync type to Python script
      const scriptMap: Record<string, string> = {
        default: 'run_incremental.py',
        fast_clients_3days: 'run_fast_client_sync.py',
        fast_bo_bi_only: 'run_fast_bo_bi_sync.py',
        fast_all: 'run_fast_all_tables_sync.py',
      }

      const scriptName = scriptMap[syncType] || scriptMap.default
      console.log(`🚀 Starting ${syncType} ETL sync...`)
      
      const scriptPath = path.join(etlScriptsPath, scriptName)
      const command = `"${pythonPath}" "${scriptPath}"`

      console.log(`📝 Executing: ${command}`)
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 600000, // 10 minutes
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      })

      console.log('📤 ETL Output:', stdout)
      if (stderr) console.error('⚠️ ETL Warnings:', stderr)

      // Check for success marker
      const success = stdout.includes('__ETL_DONE__ success=true')
      
      if (success) {
        console.log(`✅ ${syncType} ETL sync completed successfully`)
        return NextResponse.json(
          {
            success: true,
            message: `${syncType} sync completed successfully`,
            type: syncType,
            output: stdout.substring(0, 500),
          },
          { status: 200 }
        )
      } else {
        console.error(`❌ ${syncType} ETL sync failed`)
        throw new Error('ETL script did not complete successfully')
      }
    }

    // No ETL configured
    console.warn('⚠️ No ETL configuration found')
    return NextResponse.json(
      {
        success: false,
        message: 'ETL not configured. Set ETL_SYNC_URL or ETL_SCRIPTS_PATH in .env.local',
      },
      { status: 500 }
    )
  } catch (error) {
    console.error('❌ ETL incremental sync error:', error)
    return NextResponse.json(
      {
        error: 'ETL sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

