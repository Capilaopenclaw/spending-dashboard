/**
 * gc-connect-bank: Create GoCardless agreement + requisition
 * 
 * POST /gc-connect-bank
 * Body: { institution_id, institution_name, institution_logo_url?, redirect_url }
 * Returns: { requisition_id, auth_link }
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'
import { createAgreement, createRequisition } from '../_shared/gocardless.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Verify user
    const supabase = getSupabaseClient(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { institution_id, institution_name, institution_logo_url, redirect_url } = body

    if (!institution_id || !redirect_url) {
      return new Response(JSON.stringify({ error: 'institution_id and redirect_url are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const accessToken = await getValidAccessToken(supabaseAdmin)

    // 1. Create end-user agreement (90 day consent, max history)
    const agreement = await createAgreement(accessToken, institution_id)

    // 2. Create requisition with auth link
    const reference = `${user.id}_${Date.now()}`
    const requisition = await createRequisition(
      accessToken,
      institution_id,
      redirect_url,
      agreement.id,
      reference,
      'SK'
    )

    // 3. Store bank connection in DB
    const consentExpiresAt = new Date()
    consentExpiresAt.setDate(consentExpiresAt.getDate() + 90)

    const { error: insertError } = await supabaseAdmin
      .from('bank_connections')
      .insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        provider: 'gocardless',
        institution_id,
        institution_name: institution_name || institution_id,
        institution_logo_url: institution_logo_url || null,
        requisition_id: requisition.id,
        agreement_id: agreement.id,
        status: 'pending',
        consent_expires_at: consentExpiresAt.toISOString(),
        metadata: { reference, requisition_status: requisition.status },
      })

    if (insertError) {
      console.error('Failed to store bank connection:', insertError)
      throw new Error('Failed to store bank connection')
    }

    return new Response(
      JSON.stringify({
        requisition_id: requisition.id,
        auth_link: requisition.link,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('gc-connect-bank error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
