/**
 * gc-disconnect-bank: Delete requisition and revoke access
 * 
 * POST /gc-disconnect-bank
 * Body: { bank_connection_id }
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'
import { deleteRequisition } from '../_shared/gocardless.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseClient(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { bank_connection_id } = body

    if (!bank_connection_id) {
      return new Response(JSON.stringify({ error: 'bank_connection_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get connection
    const { data: connection, error: connError } = await supabaseAdmin
      .from('bank_connections')
      .select('*')
      .eq('id', bank_connection_id)
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Bank connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete requisition from GoCardless
    try {
      const accessToken = await getValidAccessToken(supabaseAdmin)
      await deleteRequisition(accessToken, connection.requisition_id)
    } catch (e) {
      // GoCardless may already have removed it — log but continue
      console.warn('GoCardless delete failed (may already be removed):', e)
    }

    // Mark connection as revoked
    await supabaseAdmin
      .from('bank_connections')
      .update({ status: 'revoked' })
      .eq('id', bank_connection_id)

    // Deactivate all accounts under this connection
    await supabaseAdmin
      .from('accounts')
      .update({ is_active: false })
      .eq('bank_connection_id', bank_connection_id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bank connection revoked and accounts deactivated',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('gc-disconnect-bank error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
