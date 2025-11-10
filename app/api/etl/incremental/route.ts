import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes timeout (Vercel hobby plan limit)

/**
 * Incremental ETL Sync
 * Supports different sync types:
 * - default: run_incremental.py (regular incremental)
 * - fast_clients_3days: run_fast_client_sync.py (last 3 days contacts)
 * - fast_bo_bi_only: run_fast_bo_bi_sync.py (BO/BI tables with watermark)
 * - fast_all: run_fast_all_tables_sync.py (all tables with watermark)
 * - today_clients: run_today_clients.py (clients from today 00:00:00)
 * - today_bo_bi: run_today_bo_bi.py (BO/BI/CL from today 00:00:00)
 * - today_all: run_today_all.py (all tables from today 00:00:00)
 * POST /api/etl/incremental
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const syncType = body.type || 'default'
    
    const externalUrl = process.env.ETL_SYNC_URL
    const isWindows = process.platform === 'win32'
    const pythonPath = process.env.PYTHON_PATH || (isWindows ? 'python' : 'python3')
    const pythonArgs = process.env.PYTHON_ARGS || ''
    const etlScriptsPath = process.env.ETL_SCRIPTS_PATH
    const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_PAT
    const ghRepoOwner = process.env.GH_REPO_OWNER
    const ghRepoName = process.env.GH_REPO_NAME
    const ghWorkflowFile = process.env.GH_WORKFLOW_FILE || 'daily-etl-sync.yml'
    const ghRef = process.env.GH_REF || 'main'
    // Map UI sync types to dedicated workflow files for clearer, separate runs
    const ghWorkflowMap: Record<string, string> = {
      today_clients: 'today-clients-sync.yml',
      today_bo_bi: 'today-bo-bi-sync.yml',
      today_fl: 'today-fl-sync.yml',
      today_all: 'today-all-sync.yml',
      fast_all: ghWorkflowFile,
    }
    const workflowToDispatch = ghWorkflowMap[syncType] || ghWorkflowFile
    const shouldSendInputs = workflowToDispatch === ghWorkflowFile
    
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

    // Option 2: Run local Python ETL script (Windows-only; dev/local use)
    if (etlScriptsPath) {
      // Prevent attempting to run Windows paths on a non-Windows runtime (e.g., Vercel/Linux)
      const looksLikeWindowsPath = /[A-Za-z]:\\/.test(etlScriptsPath)
      if (!isWindows) {
        // Fallback: dispatch GitHub Action when running on non-Windows environments
        if (ghToken && ghRepoOwner && ghRepoName) {
          const url = `https://api.github.com/repos/${ghRepoOwner}/${ghRepoName}/actions/workflows/${workflowToDispatch}/dispatches`
          console.log('🔁 Non-Windows runtime detected. Dispatching GitHub Action:', url)

          if (shouldSendInputs) {
            // Combined daily workflow: try with inputs, then fallback
            let resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${ghToken}`,
              },
              body: JSON.stringify({ ref: ghRef, inputs: { type: syncType } }),
            })

            if (!resp.ok) {
              const text = await resp.text().catch(() => '')
              // If workflow doesn't define inputs, GitHub may return 422
              if (resp.status === 422 || /inputs/i.test(text)) {
                console.warn('⚠️ Inputs likely not supported by workflow. Retrying dispatch without inputs.')
                const resp2 = await fetch(url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${ghToken}`,
                  },
                  body: JSON.stringify({ ref: ghRef }),
                })

                if (!resp2.ok) {
                  const text2 = await resp2.text().catch(() => '')
                  throw new Error(`GitHub dispatch failed (fallback): ${resp2.status} ${text2}`)
                }

                return NextResponse.json(
                  {
                    success: true,
                    message: 'ETL dispatched to GitHub Actions (fallback without inputs)',
                    dispatch: { workflow: workflowToDispatch, repo: `${ghRepoOwner}/${ghRepoName}`, ref: ghRef, type: syncType, inputsSupported: false },
                  },
                  { status: 200 },
                )
              }

              throw new Error(`GitHub dispatch failed: ${resp.status} ${text}`)
            }

            return NextResponse.json(
              {
                success: true,
                message: 'ETL dispatched to GitHub Actions',
                dispatch: { workflow: workflowToDispatch, repo: `${ghRepoOwner}/${ghRepoName}`, ref: ghRef, type: syncType, inputsSupported: true },
              },
              { status: 200 },
            )
          } else {
            // Dedicated today-* workflows don’t expect inputs
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${ghToken}`,
              },
              body: JSON.stringify({ ref: ghRef }),
            })

            if (!resp.ok) {
              const text = await resp.text().catch(() => '')
              throw new Error(`GitHub dispatch failed: ${resp.status} ${text}`)
            }

            return NextResponse.json(
              {
                success: true,
                message: 'ETL dispatched to GitHub Actions',
                dispatch: { workflow: workflowToDispatch, repo: `${ghRepoOwner}/${ghRepoName}`, ref: ghRef, type: syncType, inputsSupported: false },
              },
              { status: 200 },
            )
          }
        }

        return NextResponse.json(
          {
            success: false,
            message: 'Local ETL is only supported when the server runs on Windows.',
            details: `Detected runtime: ${process.platform}. Configure ETL_SYNC_URL or set GH_TOKEN/GH_REPO_OWNER/GH_REPO_NAME for GitHub Actions dispatch.`,
          },
          { status: 500 },
        )
      }

      // Map sync type to Python script
      const scriptMap: Record<string, string> = {
        // Default incremental: for simplicity, use fast_all watermark sync
        default: 'run_fast_all_tables_sync.py',
        // Map archived fast variants to today-based equivalents to keep UI buttons working
        fast_clients_3days: 'run_today_clients.py',
        fast_bo_bi_only: 'run_today_bo_bi.py',
        fast_all: 'run_fast_all_tables_sync.py',
        today_clients: 'run_today_clients.py',
        today_bo_bi: 'run_today_bo_bi.py',
        today_fl: 'run_today_fl.py',
        // today_all archived; route to fast_all which is short and safe
        today_all: 'run_fast_all_tables_sync.py',
      }

      const scriptName = scriptMap[syncType] || scriptMap.default
      console.log(`🚀 Starting ${syncType} ETL sync...`)
      
      // Support both absolute and relative paths, across Windows/Posix
      const isAbs = path.win32.isAbsolute(etlScriptsPath) || path.posix.isAbsolute(etlScriptsPath)
      const resolvedPath = isAbs ? etlScriptsPath : path.join(process.cwd(), etlScriptsPath)

      const scriptPath = path.join(resolvedPath, scriptName)
      const pythonCmd = pythonArgs ? `"${pythonPath}" ${pythonArgs}` : `"${pythonPath}"`
      const command = `${pythonCmd} "${scriptPath}"`

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

    // No ETL configured: try GitHub Dispatch if available
    if (ghToken && ghRepoOwner && ghRepoName) {
      const url = `https://api.github.com/repos/${ghRepoOwner}/${ghRepoName}/actions/workflows/${workflowToDispatch}/dispatches`
      console.log('🔁 No local/external ETL configured. Dispatching GitHub Action:', url)

      // First try with inputs
      let resp: Response
      if (shouldSendInputs) {
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${ghToken}`,
          },
          body: JSON.stringify({ ref: ghRef, inputs: { type: syncType } }),
        })
      } else {
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${ghToken}`,
          },
          body: JSON.stringify({ ref: ghRef }),
        })
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        console.error('❌ GitHub dispatch failed:', resp.status, text)

        // If inputs are not supported, retry without inputs
        if (resp.status === 422 || /inputs/i.test(text)) {
          console.warn('⚠️ Inputs likely not supported by workflow. Retrying dispatch without inputs.')
          const resp2 = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${ghToken}`,
            },
            body: JSON.stringify({ ref: ghRef }),
          })

          if (!resp2.ok) {
            const text2 = await resp2.text().catch(() => '')
            return NextResponse.json(
              {
                success: false,
                message: 'Failed to dispatch ETL to GitHub Actions (fallback without inputs)',
                status: resp2.status,
                details: text2.substring(0, 300),
              },
              { status: 500 },
            )
          }

          return NextResponse.json(
            {
              success: true,
              message: 'ETL dispatched to GitHub Actions (fallback without inputs)',
              dispatch: { workflow: workflowToDispatch, repo: `${ghRepoOwner}/${ghRepoName}`, ref: ghRef, type: syncType, inputsSupported: false },
            },
            { status: 200 },
          )
        }

        return NextResponse.json(
          {
            success: false,
            message: 'Failed to dispatch ETL to GitHub Actions',
            status: resp.status,
            details: text.substring(0, 300),
          },
          { status: 500 },
        )
      }

      return NextResponse.json(
        {
          success: true,
          message: 'ETL dispatched to GitHub Actions',
          dispatch: { workflow: workflowToDispatch, repo: `${ghRepoOwner}/${ghRepoName}`, ref: ghRef, type: syncType, inputsSupported: shouldSendInputs },
        },
        { status: 200 },
      )
    }

    // No ETL configured and no GitHub dispatch available
    console.warn('⚠️ No ETL configuration found and GitHub dispatch not configured')
    return NextResponse.json(
      {
        success: false,
        message: 'ETL not configured. Set ETL_SYNC_URL or ETL_SCRIPTS_PATH in .env.local, or configure GH_TOKEN/GH_REPO_OWNER/GH_REPO_NAME.',
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

