/**
 * gc-health-check: Check consent expiry (90 days) and connection status
 * 
 * POST /gc-health-check — Daily cron target (03:00)
 * Marks connections as expired when consent runs out.
 * Uses service role — no user auth needed.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'
import { getRequisition } from '../_shared/gocardless.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Verify cron secret
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey || !authHeader?.includes(serviceKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Check for expired consents
    const now = new Date().toISOString()
    const { data: expiredConnections } = await supabaseAdmin
      .from('bank_connections')
      .select('id, user_id, institution_name, consent_expires_at')
      .eq('status', 'linked')
      .lt('consent_expires_at', now)

    let expiredCount = 0
    if (expiredConnections?.length) {
      for (const conn of expiredConnections) {
        await supabaseAdmin
          .from('bank_connections')
          .update({ status: 'expired' })
          .eq('id', conn.id)

        // Deactivate accounts
        await supabaseAdmin
          .from('accounts')
          .update({ is_active: false })
          .eq('bank_connection_id', conn.id)

        expiredCount++
      }
    }

    // 2. Check connections expiring in next 7 days (for warnings)
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

    const { data: expiringConnections } = await supabaseAdmin
      .from('bank_connections')
      .select('id, user_id, institution_name, consent_expires_at')
      .eq('status', 'linked')
      .gt('consent_expires_at', now)
      .lt('consent_expires_at', sevenDaysFromNow.toISOString())

    // 3. Verify actual GoCardless status for linked connections (spot check)
    let verifiedCount = 0
    let statusMismatches = 0

    const accessToken = await getValidAccessToken(supabaseAdmin)

    // Only check a sample to avoid rate limits
    const { data: linkedConnections } = await supabaseAdmin
      .from('bank_connections')
      .select('id, requisition_id')
      .eq('status', 'linked')
      .limit(5) // rate-limit friendly

    if (linkedConnections?.length) {
      for (const conn of linkedConnections) {
        try {
          const requisition = await getRequisition(accessToken, conn.requisition_id)
          verifiedCount++

          if (requisition.status !== 'LN') {
            const statusMap: Record<string, string> = {
              EX: 'expired', RJ: 'error', CR: 'pending',
            }
            const newStatus = statusMap[requisition.status] || 'error'

            await supabaseAdmin
              .from('bank_connections')
              .update({
                status: newStatus,
                metadata: { last_health_check: now, gc_status: requisition.status },
              })
              .eq('id', conn.id)

            if (newStatus === 'expired' || newStatus === 'error') {
              await supabaseAdmin
                .from('accounts')
                .update({ is_active: false })
                .eq('bank_connection_id', conn.id)
            }

            statusMismatches++
          }
        } catch (e) {
          console.warn(`Health check failed for connection ${conn.id}:`, e)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_connections: expiredCount,
        expiring_soon: expiringConnections?.length || 0,
        verified: verifiedCount,
        status_mismatches: statusMismatches,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('gc-health-check error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
