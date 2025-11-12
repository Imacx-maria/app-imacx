import { NextRequest, NextResponse } from 'next/server'
import sql from 'mssql'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30 // 30 seconds timeout

/**
 * Get live FO (Folha de Obra) total value directly from PHC database
 *
 * This endpoint bypasses Supabase cache and queries the real PHC SQL Server
 * database to get the latest total_value for a specific FO number.
 *
 * Use case: When an FO is older than 3 days (outside Supabase sync window)
 * and the value was updated in PHC, this provides the fresh value.
 *
 * POST /api/phc/fo-value
 * Body: { foNumber: string }
 * Response: { success: boolean, foNumber: string, totalValue: number | null, error?: string }
 */
export async function POST(req: NextRequest) {
  let connection: sql.ConnectionPool | null = null

  try {
    const body = await req.json()
    const { foNumber, jobId } = body

    if (!foNumber) {
      return NextResponse.json(
        { success: false, error: 'FO number is required' },
        { status: 400 }
      )
    }

    console.log(`🔍 [PHC Direct] Querying live PHC for FO: ${foNumber}`)

    // Get connection string from environment
    const connectionString = process.env.MSSQL_DIRECT_CONNECTION

    if (!connectionString) {
      console.error('❌ [PHC Direct] MSSQL_DIRECT_CONNECTION not configured')
      return NextResponse.json(
        {
          success: false,
          error: 'PHC database connection not configured'
        },
        { status: 500 }
      )
    }

    // Connect to PHC SQL Server
    connection = await sql.connect(connectionString)
    console.log('✅ [PHC Direct] Connected to PHC database')

    // Query BOTH bo AND fo tables for the FO's value
    // Try fo table first (has ettiliq = net liquid value), then bo table as fallback

    // First try: FO table (Folha de Obra documents)
    // adoc = FO document number
    // ettiliq = net liquid value (this is typically what you want)
    // etotal = total value
    // IMPORTANT: Filter by current year to avoid old documents with same FO number
    const currentYear = new Date().getFullYear()

    const foResult = await connection
      .request()
      .input('foNumber', sql.NVarChar, foNumber.trim())
      .input('currentYear', sql.Int, currentYear)
      .query(`
        SELECT TOP 5
          adoc AS document_number,
          ettiliq AS net_liquid_value,
          etotal AS total_value,
          tipo AS document_type,
          pdata AS document_date
        FROM fo
        WHERE adoc = @foNumber
          AND YEAR(pdata) = @currentYear
        ORDER BY pdata DESC
      `)

    console.log(`📊 [PHC Direct] FO table query returned ${foResult.recordset.length} rows`)

    // Log ALL rows to see what document types exist
    if (foResult.recordset.length > 0) {
      console.log('📋 [PHC Direct] All FO records found:')
      foResult.recordset.forEach((row, idx) => {
        console.log(`   ${idx + 1}. Type: "${row.document_type}" | Date: ${row.document_date} | ettiliq: ${row.net_liquid_value} | etotal: ${row.total_value}`)
      })
    }

    if (foResult.recordset.length > 0) {
      const row = foResult.recordset[0]
      const netLiquid = row.net_liquid_value ? parseFloat(row.net_liquid_value) : 0
      const totalValue = row.total_value ? parseFloat(row.total_value) : 0

      console.log(`💰 [PHC Direct] FO ${foNumber} from FO table:`)
      console.log(`   - Net Liquid (ettiliq): ${netLiquid}€`)
      console.log(`   - Total (etotal): ${totalValue}€`)

      // Write the value to Supabase for persistence (using existing Euro__tota column)
      if (jobId) {
        try {
          // Use service role key for server-side writes (bypasses RLS)
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )

          console.log(`💾 [PHC Direct] Attempting to write ${netLiquid}€ to Euro__tota for job ${jobId}`)

          const { data: updateData, error: updateError } = await supabase
            .from('folhas_obras')
            .update({ Euro__tota: netLiquid })
            .eq('id', jobId)
            .select()

          if (updateError) {
            console.error('⚠️ [PHC Direct] Failed to persist value to Supabase:', updateError)
            console.error('⚠️ [PHC Direct] Error details:', JSON.stringify(updateError, null, 2))
          } else {
            console.log(`✅ [PHC Direct] Successfully persisted ${netLiquid}€ to Euro__tota for job ${jobId}`)
            console.log(`✅ [PHC Direct] Updated row:`, updateData)
          }
        } catch (supabaseError) {
          console.error('⚠️ [PHC Direct] Supabase write exception:', supabaseError)
        }
      }

      return NextResponse.json({
        success: true,
        foNumber,
        totalValue: netLiquid, // Using net liquid value (ettiliq)
        totalValueRaw: totalValue, // Also return etotal for reference
        documentDate: row.document_date,
        documentType: row.document_type,
        source: 'fo_table'
      })
    }

    // Fallback: Try BO table (Budget/Work Order)
    // obrano = FO number
    // ebo_2tvall = total value
    // nmdos = document type
    // Also filter by current year
    console.log(`📊 [PHC Direct] FO not found in FO table, trying BO table...`)

    const boResult = await connection
      .request()
      .input('foNumber', sql.NVarChar, foNumber.trim())
      .input('currentYear', sql.Int, currentYear)
      .query(`
        SELECT TOP 5
          obrano AS document_number,
          ebo_2tvall AS total_value,
          nmdos AS document_type,
          dataobra AS document_date
        FROM bo
        WHERE obrano = @foNumber
          AND nmdos = 'Folha de Obra'
          AND YEAR(dataobra) = @currentYear
        ORDER BY dataobra DESC
      `)

    console.log(`📊 [PHC Direct] BO table query returned ${boResult.recordset.length} rows`)

    // Log ALL BO rows to see what documents exist
    if (boResult.recordset.length > 0) {
      console.log('📋 [PHC Direct] All BO records found:')
      boResult.recordset.forEach((row, idx) => {
        console.log(`   ${idx + 1}. Type: "${row.document_type}" | Date: ${row.document_date} | ebo_2tvall: ${row.total_value}`)
      })
    }

    if (boResult.recordset.length === 0) {
      console.warn(`⚠️ [PHC Direct] No FO found in either FO or BO tables for number: ${foNumber} (year: ${currentYear})`)
      return NextResponse.json({
        success: true,
        foNumber,
        totalValue: null,
        message: `FO not found in PHC database for year ${currentYear} (searched both FO and BO tables)`
      })
    }

    const row = boResult.recordset[0]
    const totalValue = row.total_value ? parseFloat(row.total_value) : 0

    console.log(`💰 [PHC Direct] FO ${foNumber} from BO table (using first record): ${totalValue}€`)

    // Write the value to Supabase for persistence (using existing Euro__tota column)
    if (jobId) {
      try {
        // Use service role key for server-side writes (bypasses RLS)
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        console.log(`💾 [PHC Direct] Attempting to write ${totalValue}€ to Euro__tota for job ${jobId}`)

        const { data: updateData, error: updateError } = await supabase
          .from('folhas_obras')
          .update({ Euro__tota: totalValue })
          .eq('id', jobId)
          .select()

        if (updateError) {
          console.error('⚠️ [PHC Direct] Failed to persist value to Supabase:', updateError)
          console.error('⚠️ [PHC Direct] Error details:', JSON.stringify(updateError, null, 2))
        } else {
          console.log(`✅ [PHC Direct] Successfully persisted ${totalValue}€ to Euro__tota for job ${jobId}`)
          console.log(`✅ [PHC Direct] Updated row:`, updateData)
        }
      } catch (supabaseError) {
        console.error('⚠️ [PHC Direct] Supabase write exception:', supabaseError)
      }
    }

    return NextResponse.json({
      success: true,
      foNumber,
      totalValue,
      documentDate: row.document_date,
      documentType: row.document_type,
      source: 'bo_table'
    })

  } catch (error: any) {
    console.error('❌ [PHC Direct] Error querying PHC:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to query PHC database'
      },
      { status: 500 }
    )
  } finally {
    // Always close the connection
    if (connection) {
      try {
        await connection.close()
        console.log('🔌 [PHC Direct] Connection closed')
      } catch (closeError) {
        console.warn('⚠️ [PHC Direct] Error closing connection:', closeError)
      }
    }
  }
}
