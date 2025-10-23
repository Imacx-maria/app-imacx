import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const maxDuration = 1800 // 30 minutes timeout

/**
 * Full ETL Sync
 * Syncs all records (complete data refresh - typically 20+ minutes)
 * POST /api/etl/full
 */
export async function POST(req: NextRequest) {
  try {
    const externalUrl = process.env.ETL_SYNC_URL
    const pythonPath = process.env.PYTHON_PATH || 'python'
    const etlScriptsPath = process.env.ETL_SCRIPTS_PATH

    // Option 1: Use external ETL service
    if (externalUrl) {
      const response = await fetch(`${externalUrl}/etl/full`, {
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
        { success: true, message: 'Full sync completed', data },
        { status: 200 }
      )
    }

    // Option 2: Run local Python ETL script
    if (etlScriptsPath) {
      console.log('🚀 Starting Full ETL sync (this may take 20+ minutes)...')
      
      const scriptPath = path.join(etlScriptsPath, 'run_full.py')
      const command = `"${pythonPath}" "${scriptPath}"`

      console.log(`📝 Executing: ${command}`)
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 1800000, // 30 minutes
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
      })

      console.log('📤 ETL Output:', stdout)
      if (stderr) console.error('⚠️ ETL Warnings:', stderr)

      // Check for success marker
      const success = stdout.includes('__ETL_DONE__ success=true')
      
      if (success) {
        console.log('✅ Full ETL sync completed successfully')
        return NextResponse.json(
          {
            success: true,
            message: 'Full sync completed successfully',
            output: stdout.substring(0, 500), // First 500 chars
          },
          { status: 200 }
        )
      } else {
        console.error('❌ Full ETL sync failed')
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
    console.error('❌ ETL full sync error:', error)
    return NextResponse.json(
      {
        error: 'ETL sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

