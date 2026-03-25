/**
 * gc-callback: Handle redirect after bank auth
 * 
 * POST /gc-callback
 * Body: { requisition_id }
 * Fetches account IDs, stores accounts, triggers initial sync.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'
import { getRequisition, getAccountDetails, getAccountBalances } from '../_shared/gocardless.ts'

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
    const { requisition_id } = body

    if (!requisition_id) {
      return new Response(JSON.stringify({ error: 'requisition_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const accessToken = await getValidAccessToken(supabaseAdmin)

    // 1. Get requisition status and account IDs
    const requisition = await getRequisition(accessToken, requisition_id)

    // 2. Find our bank_connection record
    const { data: connection, error: connError } = await supabaseAdmin
      .from('bank_connections')
      .select('*')
      .eq('requisition_id', requisition_id)
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Bank connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Map GoCardless status to our status
    const statusMap: Record<string, string> = {
      LN: 'linked', EX: 'expired', RJ: 'error',
      CR: 'pending', GC: 'pending', UA: 'pending',
      SA: 'pending', GA: 'pending',
    }
    const newStatus = statusMap[requisition.status] || 'error'

    // Update connection status
    await supabaseAdmin
      .from('bank_connections')
      .update({
        status: newStatus,
        metadata: { ...((connection.metadata as any) || {}), requisition_status: requisition.status },
      })
      .eq('id', connection.id)

    if (requisition.status !== 'LN') {
      return new Response(
        JSON.stringify({
          status: newStatus,
          requisition_status: requisition.status,
          message: `Requisition is ${requisition.status}, not yet linked`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Fetch details for each account
    const accountsCreated = []
    for (const externalAccountId of requisition.accounts) {
      try {
        // Get account details
        let details: any = {}
        try {
          const detailsResponse = await getAccountDetails(accessToken, externalAccountId)
          details = detailsResponse.account || {}
        } catch (e) {
          console.warn(`Could not fetch details for account ${externalAccountId}:`, e)
        }

        // Get balances
        let currentBalance: number | null = null
        let availableBalance: number | null = null
        try {
          const balancesResponse = await getAccountBalances(accessToken, externalAccountId)
          for (const bal of balancesResponse.balances || []) {
            if (bal.balanceType === 'interimAvailable' || bal.balanceType === 'expected') {
              availableBalance = parseFloat(bal.balanceAmount.amount)
            }
            if (bal.balanceType === 'closingBooked' || bal.balanceType === 'interimBooked') {
              currentBalance = parseFloat(bal.balanceAmount.amount)
            }
          }
          // Fallback: if only one balance type returned
          if (currentBalance === null && availableBalance !== null) {
            currentBalance = availableBalance
          }
        } catch (e) {
          console.warn(`Could not fetch balances for account ${externalAccountId}:`, e)
        }

        // Determine account type from bank data
        const accountType = guessAccountType(details.cashAccountType, details.product, details.name)

        const accountId = crypto.randomUUID()
        const { error: insertError } = await supabaseAdmin.from('accounts').insert({
          id: accountId,
          user_id: user.id,
          bank_connection_id: connection.id,
          external_account_id: externalAccountId,
          iban: details.iban || null,
          account_name: details.name || details.product || null,
          account_type: accountType,
          currency: details.currency || 'EUR',
          current_balance: currentBalance,
          available_balance: availableBalance,
          balance_updated_at: currentBalance !== null ? new Date().toISOString() : null,
          is_primary: accountsCreated.length === 0, // first account is primary
          is_active: true,
        })

        if (insertError) {
          console.error(`Failed to insert account ${externalAccountId}:`, insertError)
        } else {
          accountsCreated.push({
            id: accountId,
            external_account_id: externalAccountId,
            iban: details.iban,
            name: details.name || details.product,
          })
        }
      } catch (e) {
        console.error(`Error processing account ${externalAccountId}:`, e)
      }
    }

    // Update last_synced_at
    await supabaseAdmin
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connection.id)

    return new Response(
      JSON.stringify({
        status: 'linked',
        accounts_created: accountsCreated.length,
        accounts: accountsCreated,
        message: `Successfully linked ${accountsCreated.length} account(s). Trigger gc-sync-transactions for initial transaction import.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('gc-callback error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function guessAccountType(
  cashAccountType?: string,
  product?: string,
  name?: string
): string {
  const combined = `${cashAccountType || ''} ${product || ''} ${name || ''}`.toLowerCase()

  if (combined.includes('savings') || combined.includes('sporien') || combined.includes('sporiac')) {
    return 'savings'
  }
  if (combined.includes('credit') || combined.includes('kreditn')) {
    return 'credit_card'
  }
  if (combined.includes('loan') || combined.includes('úver') || combined.includes('hypot')) {
    return 'loan'
  }
  return 'checking'
}
