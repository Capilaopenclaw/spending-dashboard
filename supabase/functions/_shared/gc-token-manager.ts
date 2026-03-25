/**
 * Manages GoCardless tokens stored in gc_tokens table.
 * Handles automatic refresh when access token is expired or about to expire.
 */

import { createToken, refreshAccessToken } from './gocardless.ts'

interface StoredTokens {
  id: string
  access_token: string
  refresh_token: string
  access_expires_at: string
  refresh_expires_at: string
}

/**
 * Get a valid GC access token. Auto-refreshes if expired.
 * Uses a simple key-value approach in gc_tokens table.
 */
export async function getValidAccessToken(supabaseAdmin: any): Promise<string> {
  // Get stored tokens
  const { data: tokens, error } = await supabaseAdmin
    .from('gc_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !tokens) {
    // No tokens — need to create new ones
    return await createNewTokens(supabaseAdmin)
  }

  const now = new Date()
  const accessExpires = new Date(tokens.access_expires_at)
  const refreshExpires = new Date(tokens.refresh_expires_at)

  // Access token still valid (with 1h buffer)
  if (accessExpires.getTime() - now.getTime() > 3600000) {
    return tokens.access_token
  }

  // Access expired but refresh still valid
  if (refreshExpires > now) {
    return await refreshAndStore(supabaseAdmin, tokens)
  }

  // Both expired — need new tokens
  return await createNewTokens(supabaseAdmin)
}

async function createNewTokens(supabaseAdmin: any): Promise<string> {
  const secretId = Deno.env.get('GOCARDLESS_SECRET_ID')
  const secretKey = Deno.env.get('GOCARDLESS_SECRET_KEY')

  if (!secretId || !secretKey) {
    throw new Error('GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY must be set')
  }

  const result = await createToken(secretId, secretKey)
  const now = new Date()

  await supabaseAdmin.from('gc_tokens').insert({
    access_token: result.access,
    refresh_token: result.refresh,
    access_expires_at: new Date(now.getTime() + result.access_expires * 1000).toISOString(),
    refresh_expires_at: new Date(now.getTime() + result.refresh_expires * 1000).toISOString(),
  })

  return result.access
}

async function refreshAndStore(supabaseAdmin: any, stored: StoredTokens): Promise<string> {
  const result = await refreshAccessToken(stored.refresh_token)
  const now = new Date()

  await supabaseAdmin
    .from('gc_tokens')
    .update({
      access_token: result.access,
      access_expires_at: new Date(now.getTime() + result.access_expires * 1000).toISOString(),
    })
    .eq('id', stored.id)

  return result.access
}
