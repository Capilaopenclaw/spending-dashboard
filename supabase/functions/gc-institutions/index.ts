/**
 * gc-institutions: List banks by country from GoCardless
 * 
 * GET /gc-institutions?country=sk — List Slovak banks
 * Caches results in memory for 24h (edge function lifetime).
 * Requires user auth.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'
import { listInstitutions } from '../_shared/gocardless.ts'

// Simple in-memory cache (lasts for edge function lifetime)
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Verify user is authenticated
    const supabase = getSupabaseClient(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const country = url.searchParams.get('country') || 'sk'
    const cacheKey = `institutions:${country}`

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch from GoCardless
    const supabaseAdmin = getSupabaseAdmin()
    const accessToken = await getValidAccessToken(supabaseAdmin)
    const institutions = await listInstitutions(accessToken, country)

    // Cache result
    cache.set(cacheKey, { data: institutions, expiresAt: Date.now() + CACHE_TTL_MS })

    return new Response(JSON.stringify(institutions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('gc-institutions error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
