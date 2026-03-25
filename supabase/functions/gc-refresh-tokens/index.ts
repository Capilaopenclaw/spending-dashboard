import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase.ts'
import { refreshAccessToken } from '../_shared/gc-token-manager.ts'

/**
 * gc-refresh-tokens
 * Proactively refreshes GoCardless access tokens before expiry
 * Called by cron job every 12 hours
 */

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = getSupabaseAdmin()

    // Find tokens expiring in next 24 hours
    const { data: tokens, error } = await supabase
      .from('gc_tokens')
      .select('*')
      .lt('access_expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .gt('refresh_expires_at', new Date().toISOString())

    if (error) {
      console.error('Failed to query gc_tokens:', error)
      return new Response(JSON.stringify({ error: 'Database query failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No tokens need refresh', refreshed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []
    for (const token of tokens) {
      try {
        console.log(`Refreshing token ${token.id}`)
        await refreshAccessToken(supabase)
        results.push({ id: token.id, status: 'success' })
      } catch (e: any) {
        console.error(`Failed to refresh token ${token.id}:`, e)
        results.push({ id: token.id, status: 'error', error: e.message })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length

    return new Response(
      JSON.stringify({
        message: `Refreshed ${successCount}/${tokens.length} tokens`,
        refreshed: successCount,
        total: tokens.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('gc-refresh-tokens error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
