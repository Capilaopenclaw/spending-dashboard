/**
 * gc-sync-transactions: Fetch, normalize, and store transactions
 * 
 * POST /gc-sync-transactions
 * Body: { account_id, full_sync?: boolean }
 * 
 * After storing transactions, runs transfer detection across all
 * of the user's accounts to identify inter-account transfers.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getSupabaseClient, getSupabaseAdmin } from '../_shared/supabase.ts'
import { getValidAccessToken } from '../_shared/gc-token-manager.ts'
import { getAccountTransactions, type GCTransaction } from '../_shared/gocardless.ts'

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
    const { account_id, full_sync = false } = body

    if (!account_id) {
      return new Response(JSON.stringify({ error: 'account_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get account record
    const { data: account, error: accError } = await supabaseAdmin
      .from('accounts')
      .select('*, bank_connections!inner(id, user_id, status, last_synced_at)')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .single()

    if (accError || !account) {
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const accessToken = await getValidAccessToken(supabaseAdmin)

    // Determine date range
    let dateFrom: string | undefined
    let dateTo: string | undefined

    if (!full_sync && account.bank_connections.last_synced_at) {
      // Incremental: last_sync - 3 days for late-posting overlap
      const lastSync = new Date(account.bank_connections.last_synced_at)
      lastSync.setDate(lastSync.getDate() - 3)
      dateFrom = lastSync.toISOString().split('T')[0]
      dateTo = new Date().toISOString().split('T')[0]
    }
    // Full sync: no date filters — fetch all available history

    // Fetch transactions from GoCardless
    const response = await getAccountTransactions(
      accessToken,
      account.external_account_id,
      dateFrom,
      dateTo
    )

    const bookedTransactions = response.transactions?.booked || []
    const pendingTransactions = response.transactions?.pending || []

    let transactionsAdded = 0
    let transactionsUpdated = 0

    // Process booked transactions
    for (const gcTxn of bookedTransactions) {
      const externalId = gcTxn.transactionId || gcTxn.internalTransactionId || generateHashId(gcTxn)
      const normalized = normalizeTransaction(gcTxn, user.id, account_id, externalId)

      const { error: upsertError } = await supabaseAdmin
        .from('transactions')
        .upsert(normalized, {
          onConflict: 'account_id,external_transaction_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        // Likely a dup — expected for incremental sync
        if (upsertError.code === '23505') {
          transactionsUpdated++
        } else {
          console.error('Upsert error:', upsertError, 'txn:', externalId)
        }
      } else {
        transactionsAdded++
      }
    }

    // Process pending transactions (use hash ID, mark in metadata)
    for (const gcTxn of pendingTransactions) {
      const externalId = gcTxn.transactionId || `pending_${generateHashId(gcTxn)}`
      const normalized = normalizeTransaction(gcTxn, user.id, account_id, externalId)
      normalized.metadata = { ...(normalized.metadata as any), is_pending: true }

      const { error: upsertError } = await supabaseAdmin
        .from('transactions')
        .upsert(normalized, {
          onConflict: 'account_id,external_transaction_id',
          ignoreDuplicates: true, // don't overwrite booked with pending
        })

      if (!upsertError) transactionsAdded++
    }

    // Update last_synced_at on connection
    await supabaseAdmin
      .from('bank_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', account.bank_connection_id)

    // Log sync
    await supabaseAdmin.from('sync_logs').insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      bank_connection_id: account.bank_connection_id,
      account_id: account_id,
      sync_type: full_sync ? 'full' : 'incremental',
      status: 'success',
      transactions_added: transactionsAdded,
      transactions_updated: transactionsUpdated,
      metadata: {
        booked_count: bookedTransactions.length,
        pending_count: pendingTransactions.length,
        date_from: dateFrom,
        date_to: dateTo,
      },
    })

    // ========================================================
    // CRITICAL: Run transfer detection after transaction sync
    // ========================================================
    const transferResult = await runTransferDetection(supabaseAdmin, user.id)

    // ========================================================
    // AI Categorization: trigger async after sync
    // ========================================================
    let categorizationResult = { categorized: 0 }
    if (transactionsAdded > 0) {
      try {
        const aiCategorizeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-categorize`
        const catResponse = await fetch(aiCategorizeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '',
          },
          body: JSON.stringify({}),
        })
        if (catResponse.ok) {
          categorizationResult = await catResponse.json()
        }
      } catch (err) {
        console.warn('AI categorization failed (non-blocking):', (err as Error).message)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactions_added: transactionsAdded,
        transactions_updated: transactionsUpdated,
        booked_fetched: bookedTransactions.length,
        pending_fetched: pendingTransactions.length,
        transfers_detected: transferResult.pairsCreated,
        probable_transfers: transferResult.probableCount,
        ai_categorized: categorizationResult.categorized || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('gc-sync-transactions error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ============================================
// Transaction Normalization
// ============================================

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

  const merchantName = extractMerchantName(gcTxn)
  const cleanedDesc = cleanDescription(description)

  // Determine transaction type
  let transactionType: string
  if (amount > 0) {
    transactionType = 'income'
  } else if (amount < 0) {
    transactionType = 'expense'
  } else {
    transactionType = 'other'
  }

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
    cleaned_description: cleanedDesc,
    merchant_name: merchantName,
    transaction_type: transactionType,
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

function extractMerchantName(gcTxn: GCTransaction): string | null {
  // For debits, creditor is the merchant; for credits, debtor is the source
  const amount = parseFloat(gcTxn.transactionAmount?.amount || '0')
  const name = amount < 0 ? gcTxn.creditorName : gcTxn.debtorName
  if (!name) return null

  // Clean up common bank formatting
  return name
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanDescription(raw: string): string {
  if (!raw) return ''

  return raw
    // Remove card numbers (last 4 digits pattern)
    .replace(/\*{4,}\d{4}/g, '')
    // Remove terminal IDs
    .replace(/\bTERM\w*\s*\d+/gi, '')
    // Remove transaction reference numbers
    .replace(/\bREF\.?\s*\d+/gi, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

function generateHashId(gcTxn: GCTransaction): string {
  const raw = `${gcTxn.transactionAmount?.amount}_${gcTxn.transactionAmount?.currency}_${gcTxn.bookingDate}_${gcTxn.remittanceInformationUnstructured || ''}`
  // Simple hash — not crypto-grade, just for dedup
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `hash_${Math.abs(hash).toString(36)}`
}

// ============================================
// Transfer Detection (inline, uses same logic as shared package)
// ============================================

async function runTransferDetection(
  supabaseAdmin: any,
  userId: string
): Promise<{ pairsCreated: number; probableCount: number }> {
  // Get all user accounts with IBANs
  const { data: accounts } = await supabaseAdmin
    .from('accounts')
    .select('id, iban')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!accounts || accounts.length < 2) {
    return { pairsCreated: 0, probableCount: 0 }
  }

  const userIBANs = new Set(
    accounts.map((a: any) => a.iban).filter(Boolean)
  )

  // Get recent unmatched transactions (last 90 days)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: transactions } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_transfer', false)
    .is('transfer_pair_id', null)
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })

  if (!transactions || transactions.length === 0) {
    return { pairsCreated: 0, probableCount: 0 }
  }

  const matched = new Set<string>()
  let pairsCreated = 0
  let probableCount = 0

  // Get transfers category ID
  const { data: transferCategory } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', 'transfers')
    .single()
  const transferCategoryId = transferCategory?.id

  // Signal 1: IBAN Match
  for (const txn of transactions) {
    if (matched.has(txn.id)) continue

    const meta = txn.metadata as any
    const counterpartyIBAN = meta?.creditorAccount?.iban || meta?.debtorAccount?.iban
    if (!counterpartyIBAN || !userIBANs.has(counterpartyIBAN)) continue

    const counterpartyAccountId = accounts.find((a: any) => a.iban === counterpartyIBAN)?.id
    if (!counterpartyAccountId || counterpartyAccountId === txn.account_id) continue

    // Find matching transaction
    const match = transactions.find((t: any) =>
      !matched.has(t.id) &&
      t.id !== txn.id &&
      t.account_id === counterpartyAccountId &&
      Math.abs(t.amount + txn.amount) < 0.01 &&
      t.currency === txn.currency &&
      Math.abs(dateDiffDays(txn.date, t.date)) <= 2
    )

    if (match) {
      const debit = txn.amount < 0 ? txn : match
      const credit = txn.amount > 0 ? txn : match

      await createTransferPairRecord(
        supabaseAdmin, userId, debit, credit,
        'iban_match', 0.99, transferCategoryId
      )
      matched.add(txn.id)
      matched.add(match.id)
      pairsCreated++
    }
  }

  // Signal 3: Amount+Date Fuzzy Match
  const unmatched = transactions.filter((t: any) => !matched.has(t.id))
  const debits = unmatched.filter((t: any) => t.amount < 0)
  const credits = unmatched.filter((t: any) => t.amount > 0)

  for (const debit of debits) {
    if (matched.has(debit.id)) continue

    const candidates = credits.filter((credit: any) =>
      !matched.has(credit.id) &&
      credit.account_id !== debit.account_id &&
      Math.abs(credit.amount + debit.amount) < 0.01 &&
      credit.currency === debit.currency &&
      Math.abs(dateDiffDays(debit.date, credit.date)) <= 2
    )

    if (candidates.length === 1) {
      const credit = candidates[0]
      const daysDiff = Math.abs(dateDiffDays(debit.date, credit.date))
      const confidence = daysDiff === 0 ? 0.85 : daysDiff === 1 ? 0.70 : 0.55

      if (confidence >= 0.70) {
        await createTransferPairRecord(
          supabaseAdmin, userId, debit, credit,
          'amount_date_match', confidence, transferCategoryId
        )
        matched.add(debit.id)
        matched.add(credit.id)
        pairsCreated++
      }
    }
  }

  // Signal 4: Keyword detection for probable single-leg transfers
  const TRANSFER_KEYWORDS = [
    'prevod', 'vlastný účet', 'vlastny ucet', 'sporenie',
    'úspory', 'uspory', 'transfer', 'own account', 'savings',
  ]

  for (const txn of transactions) {
    if (matched.has(txn.id)) continue
    const desc = `${txn.original_description || ''} ${txn.cleaned_description || ''}`.toLowerCase()
    if (TRANSFER_KEYWORDS.some(kw => desc.includes(kw))) {
      probableCount++
    }
  }

  return { pairsCreated, probableCount }
}

async function createTransferPairRecord(
  supabaseAdmin: any,
  userId: string,
  debit: any,
  credit: any,
  method: string,
  confidence: number,
  transferCategoryId: string | null
) {
  const net = debit.amount + credit.amount
  const absNet = Math.abs(net)
  let netStatus: string
  let feeAmount = 0

  if (net === 0) netStatus = 'confirmed_zero'
  else if (absNet <= 0.05) netStatus = 'confirmed_rounding'
  else if (absNet <= 5.00) { netStatus = 'confirmed_with_fee'; feeAmount = absNet }
  else netStatus = 'mismatch'

  // Don't pair if mismatch
  if (netStatus === 'mismatch') return

  const pairId = crypto.randomUUID()

  // Create transfer_pair record
  await supabaseAdmin.from('transfer_pairs').insert({
    id: pairId,
    user_id: userId,
    debit_transaction_id: debit.id,
    credit_transaction_id: credit.id,
    amount: Math.abs(debit.amount),
    currency: debit.currency,
    fee_amount: feeAmount,
    net_validation_status: netStatus,
    net_difference: net,
    detection_method: method,
    detection_confidence: confidence,
    from_account_id: debit.account_id,
    to_account_id: credit.account_id,
    booking_date: debit.date,
    is_user_confirmed: false,
    is_user_rejected: false,
  })

  // Update both transactions
  const updateData: any = {
    is_transfer: true,
    transfer_pair_id: pairId,
    transaction_type: 'transfer',
  }
  if (transferCategoryId) {
    updateData.category_id = transferCategoryId
  }

  await supabaseAdmin
    .from('transactions')
    .update(updateData)
    .in('id', [debit.id, credit.id])
}

function dateDiffDays(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}
