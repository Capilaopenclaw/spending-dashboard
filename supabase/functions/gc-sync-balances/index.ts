/**
 * gc-sync-balances: Fetch and update latest balances for accounts
 * 
 * POST /gc-sync-balances
 * Body: { account_id } or { bank_connection_id } (sync all accounts for a connection)
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'
import { getAccountBalances } from '../_shared/gocardless.ts'

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
    const { account_id, bank_connection_id } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Get accounts to sync
    let query = supabaseAdmin
      .from('accounts')
      .select('id, external_account_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (account_id) {
      query = query.eq('id', account_id)
    } else if (bank_connection_id) {
      query = query.eq('bank_connection_id', bank_connection_id)
    } else {
      return new Response(JSON.stringify({ error: 'account_id or bank_connection_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: accounts, error: accError } = await query
    if (accError || !accounts?.length) {
      return new Response(JSON.stringify({ error: 'No accounts found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await getValidAccessToken(supabaseAdmin)
    const results: Array<{ account_id: string; success: boolean; error?: string }> = []

    for (const account of accounts) {
      try {
        const balancesResponse = await getAccountBalances(accessToken, account.external_account_id)
        const balances = balancesResponse.balances || []

        let currentBalance: number | null = null
        let availableBalance: number | null = null

        for (const bal of balances) {
          const amount = parseFloat(bal.balanceAmount.amount)
          if (bal.balanceType === 'closingBooked' || bal.balanceType === 'interimBooked') {
            currentBalance = amount
          }
          if (bal.balanceType === 'interimAvailable' || bal.balanceType === 'expected') {
            availableBalance = amount
          }
        }

        if (currentBalance === null && availableBalance !== null) {
          currentBalance = availableBalance
        }

        await supabaseAdmin
          .from('accounts')
          .update({
            current_balance: currentBalance,
            available_balance: availableBalance,
            balance_updated_at: new Date().toISOString(),
          })
          .eq('id', account.id)

        results.push({ account_id: account.id, success: true })
      } catch (e) {
        console.error(`Balance sync failed for ${account.id}:`, e)
        results.push({ account_id: account.id, success: false, error: (e as Error).message })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('gc-sync-balances error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
