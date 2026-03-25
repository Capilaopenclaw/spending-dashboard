/**
 * gc-sync-all: Orchestrate full sync for all active connections
 * 
 * POST /gc-sync-all — Cron target (every 6h)
 * No user auth needed — uses service role.
 * Syncs transactions + balances for all active connections.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'
import {
  getAccountTransactions,
  getAccountBalances,
  type GCTransaction,
} from '../_shared/gocardless.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseAdmin = getSupabaseAdmin()
    let userIdFilter: string | null = null

    // 1. Determine Auth Mode
    const authHeader = req.headers.get('Authorization')
    
    if (authHeader?.startsWith('Bearer ') && authHeader.length > 50) {
      const supabase = getSupabaseClient(req)
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!error && user) {
        userIdFilter = user.id
      }
    }

    const body = await req.json().catch(() => ({}))
    if (!userIdFilter && body.user_id) {
      userIdFilter = body.user_id
    }

    const accessToken = await getValidAccessToken(supabaseAdmin)

    // 2. Get active connections
    let query = supabaseAdmin
      .from('bank_connections')
      .select('id, user_id, last_synced_at')
      .eq('status', 'linked')

    if (userIdFilter) {
      query = query.eq('user_id', userIdFilter)
    }

    const { data: connections, error: connError } = await query

    if (connError || !connections?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active connections to sync', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: Array<{
      connection_id: string
      user_id: string
      accounts_synced: number
      transactions_added: number
      errors: string[]
    }> = []

    for (const conn of connections) {
      const connResult = {
        connection_id: conn.id,
        user_id: conn.user_id,
        accounts_synced: 0,
        transactions_added: 0,
        errors: [] as string[],
      }

      try {
        // Get accounts for this connection
        const { data: accounts } = await supabaseAdmin
          .from('accounts')
          .select('id, external_account_id')
          .eq('bank_connection_id', conn.id)
          .eq('is_active', true)

        if (!accounts?.length) continue

        for (const account of accounts) {
          try {
            // Incremental sync: last_sync - 3 days
            let dateFrom: string | undefined
            if (conn.last_synced_at) {
              const lastSync = new Date(conn.last_synced_at)
              lastSync.setDate(lastSync.getDate() - 3)
              dateFrom = lastSync.toISOString().split('T')[0]
            }
            const dateTo = new Date().toISOString().split('T')[0]

            // Fetch transactions
            const txnResponse = await getAccountTransactions(
              accessToken,
              account.external_account_id,
              dateFrom,
              dateTo
            )

            const booked = txnResponse.transactions?.booked || []
            let added = 0

            for (const gcTxn of booked) {
              const externalId = gcTxn.transactionId || gcTxn.internalTransactionId || generateHashId(gcTxn)
              const normalized = normalizeTransaction(gcTxn, conn.user_id, account.id, externalId)

              const { error: upsertError } = await supabaseAdmin
                .from('transactions')
                .upsert(normalized, {
                  onConflict: 'account_id,external_transaction_id',
                  ignoreDuplicates: false,
                })

              if (!upsertError) added++
            }

            // Fetch balances
            try {
              const balResponse = await getAccountBalances(accessToken, account.external_account_id)
              const balances = balResponse.balances || []
              let current: number | null = null
              let available: number | null = null

              for (const bal of balances) {
                const amt = parseFloat(bal.balanceAmount.amount)
                if (['closingBooked', 'interimBooked'].includes(bal.balanceType)) current = amt
                if (['interimAvailable', 'expected'].includes(bal.balanceType)) available = amt
              }
              if (current === null && available !== null) current = available

              await supabaseAdmin
                .from('accounts')
                .update({
                  current_balance: current,
                  available_balance: available,
                  balance_updated_at: new Date().toISOString(),
                })
                .eq('id', account.id)
            } catch (e) {
              connResult.errors.push(`Balance fetch failed for ${account.id}: ${(e as Error).message}`)
            }

            connResult.accounts_synced++
            connResult.transactions_added += added

            // Log sync
            await supabaseAdmin.from('sync_logs').insert({
              id: crypto.randomUUID(),
              user_id: conn.user_id,
              bank_connection_id: conn.id,
              account_id: account.id,
              sync_type: 'incremental',
              status: 'success',
              transactions_added: added,
              transactions_updated: 0,
              metadata: { booked_count: booked.length, date_from: dateFrom },
            })
          } catch (e) {
            connResult.errors.push(`Account ${account.id}: ${(e as Error).message}`)
            await supabaseAdmin.from('sync_logs').insert({
              id: crypto.randomUUID(),
              user_id: conn.user_id,
              bank_connection_id: conn.id,
              account_id: account.id,
              sync_type: 'incremental',
              status: 'error',
              transactions_added: 0,
              transactions_updated: 0,
              error_message: (e as Error).message,
            })
          }
        }

        // Update connection last_synced_at
        await supabaseAdmin
          .from('bank_connections')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', conn.id)

        // Run transfer detection for this user
        await runTransferDetectionForUser(supabaseAdmin, conn.user_id)
      } catch (e) {
        connResult.errors.push(`Connection error: ${(e as Error).message}`)
      }

      results.push(connResult)
    }

    const totalAdded = results.reduce((s, r) => s + r.transactions_added, 0)
    const totalAccounts = results.reduce((s, r) => s + r.accounts_synced, 0)

    return new Response(
      JSON.stringify({
        success: true,
        connections_synced: results.length,
        total_accounts_synced: totalAccounts,
        total_transactions_added: totalAdded,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('gc-sync-all error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ======== Helpers (duplicated from gc-sync-transactions for self-contained edge function) ========

function normalizeTransaction(
  gcTxn: GCTransaction,
  userId: string,
  accountId: string,
  externalId: string
): Record<string, unknown> {
  const amount = parseFloat(gcTxn.transactionAmount?.amount || '0')
  const currency = gcTxn.transactionAmount?.currency || 'EUR'
  const description = gcTxn.remittanceInformationUnstructured
    || gcTxn.remittanceInformationUnstructuredArray?.join(' ')
    || gcTxn.additionalInformation
    || gcTxn.creditorName
    || gcTxn.debtorName
    || ''

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    account_id: accountId,
    external_transaction_id: externalId,
    date: gcTxn.bookingDate || new Date().toISOString().split('T')[0],
    value_date: gcTxn.valueDate || null,
    amount,
    currency,
    original_description: description,
    cleaned_description: description.replace(/\s+/g, ' ').trim(),
    merchant_name: amount < 0 ? gcTxn.creditorName || null : gcTxn.debtorName || null,
    transaction_type: amount > 0 ? 'income' : amount < 0 ? 'expense' : 'other',
    is_transfer: false,
    is_recurring: false,
    is_category_user_corrected: false,
    tags: [],
    metadata: {
      creditorName: gcTxn.creditorName,
      creditorAccount: gcTxn.creditorAccount,
      debtorName: gcTxn.debtorName,
      debtorAccount: gcTxn.debtorAccount,
      bankTransactionCode: gcTxn.bankTransactionCode,
      proprietaryBankTransactionCode: gcTxn.proprietaryBankTransactionCode,
    },
  }
}

function generateHashId(gcTxn: GCTransaction): string {
  const raw = `${gcTxn.transactionAmount?.amount}_${gcTxn.transactionAmount?.currency}_${gcTxn.bookingDate}_${gcTxn.remittanceInformationUnstructured || ''}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i)
    hash |= 0
  }
  return `hash_${Math.abs(hash).toString(36)}`
}

async function runTransferDetectionForUser(supabaseAdmin: any, userId: string) {
  // Simplified transfer detection — same logic as gc-sync-transactions
  const { data: accounts } = await supabaseAdmin
    .from('accounts').select('id, iban').eq('user_id', userId).eq('is_active', true)
  if (!accounts || accounts.length < 2) return

  const userIBANs = new Set(accounts.map((a: any) => a.iban).filter(Boolean))
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: transactions } = await supabaseAdmin
    .from('transactions').select('*')
    .eq('user_id', userId).eq('is_transfer', false)
    .is('transfer_pair_id', null)
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0])

  if (!transactions?.length) return

  const { data: transferCategory } = await supabaseAdmin
    .from('categories').select('id').eq('slug', 'transfers').single()

  const matched = new Set<string>()

  // IBAN match
  for (const txn of transactions) {
    if (matched.has(txn.id)) continue
    const meta = txn.metadata as any
    const cIBAN = meta?.creditorAccount?.iban || meta?.debtorAccount?.iban
    if (!cIBAN || !userIBANs.has(cIBAN)) continue

    const cAccountId = accounts.find((a: any) => a.iban === cIBAN)?.id
    if (!cAccountId || cAccountId === txn.account_id) continue

    const match = transactions.find((t: any) =>
      !matched.has(t.id) && t.id !== txn.id &&
      t.account_id === cAccountId &&
      Math.abs(t.amount + txn.amount) < 0.01 &&
      t.currency === txn.currency
    )

    if (match) {
      const debit = txn.amount < 0 ? txn : match
      const credit = txn.amount > 0 ? txn : match
      const net = debit.amount + credit.amount
      if (Math.abs(net) > 5) continue

      const pairId = crypto.randomUUID()
      await supabaseAdmin.from('transfer_pairs').insert({
        id: pairId, user_id: userId,
        debit_transaction_id: debit.id, credit_transaction_id: credit.id,
        amount: Math.abs(debit.amount), currency: debit.currency,
        fee_amount: Math.abs(net) > 0.05 ? Math.abs(net) : 0,
        net_validation_status: net === 0 ? 'confirmed_zero' : Math.abs(net) <= 0.05 ? 'confirmed_rounding' : 'confirmed_with_fee',
        net_difference: net, detection_method: 'iban_match', detection_confidence: 0.99,
        from_account_id: debit.account_id, to_account_id: credit.account_id,
        booking_date: debit.date, is_user_confirmed: false, is_user_rejected: false,
      })

      const updateData: any = { is_transfer: true, transfer_pair_id: pairId, transaction_type: 'transfer' }
      if (transferCategory?.id) updateData.category_id = transferCategory.id
      await supabaseAdmin.from('transactions').update(updateData).in('id', [debit.id, credit.id])
      matched.add(txn.id)
      matched.add(match.id)
    }
  }
}
