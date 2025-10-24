import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes timeout

/**
 * Annual Historical ETL Sync
 * 
 * Updates historical tables with the year that just ended + 2 previous years (3 years total)
 * Updates:
 * - 2years_bo (last 2 complete years)
 * - 2years_ft (last 2 complete years)
 * - bo_historical_monthly (last 3 years)
 * - bo_historical_monthly_salesperson (last 3 years)
 * - ft_historical_monthly (last 3 years)
 * - ft_historical_monthly_salesperson (last 3 years)
 * - Recreates historical views (v_bo_current_year_monthly_salesperson, v_ft_current_year_monthly_salesperson)
 * 
 * Example: When 2025 ends (Dec 31):
 * - 2years tables: 2024, 2025
 * - Historical monthly tables: 2023, 2024, 2025
 * 
 * POST /api/etl/annual-update
 */
export async function POST() {
  try {
    const pythonPath = process.env.PYTHON_PATH || 'python'
    const etlScriptsPath = process.env.ETL_SCRIPTS_PATH
    
    if (!etlScriptsPath) {
      return NextResponse.json(
        {
          success: false,
          message: 'ETL not configured. Set ETL_SCRIPTS_PATH in .env.local',
        },
        { status: 500 }
      )
    }

    console.log('🎉 Starting annual historical sync...')
    
    // Support both absolute and relative paths
    const resolvedPath = path.isAbsolute(etlScriptsPath)
      ? etlScriptsPath
      : path.join(process.cwd(), etlScriptsPath)
    
    const scriptPath = path.join(resolvedPath, 'run_annual_historical.py')
    const command = `"${pythonPath}" "${scriptPath}"`

    console.log(`📝 Executing: ${command}`)
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: 3600000, // 60 minutes timeout for historical sync
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large output
    })

    console.log('📤 Annual Sync Output:', stdout)
    if (stderr) console.error('⚠️ Warnings:', stderr)

    // Check for success marker
    const success = stdout.includes('__ETL_DONE__ success=true')
    
    if (success) {
      console.log('✅ Annual historical sync completed successfully')
      return NextResponse.json(
        {
          success: true,
          message: 'Annual historical sync completed successfully',
          output: stdout.substring(0, 1000), // First 1000 chars
        },
        { status: 200 }
      )
    } else {
      console.error('❌ Annual historical sync failed')
      throw new Error('Annual sync script did not complete successfully')
    }
  } catch (error) {
    console.error('❌ Annual historical sync error:', error)
    return NextResponse.json(
      {
        error: 'Annual historical sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
