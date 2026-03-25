/**
 * gc-auth: Token management for GoCardless API
 * 
 * POST /gc-auth — Create or refresh tokens
 * Called by cron (every 20h) or on-demand when token is expired.
 * Uses service role — no user auth needed.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const accessToken = await getValidAccessToken(supabaseAdmin)

    return new Response(
      JSON.stringify({ success: true, message: 'Token is valid' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('gc-auth error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
