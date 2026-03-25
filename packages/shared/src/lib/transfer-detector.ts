/**
 * Inter-account transfer detection algorithm
 * 
 * CRITICAL: Without this, spending and income are both inflated
 * because transfers appear as separate debit/credit transactions.
 * 
 * Detection pipeline:
 * 1. IBAN match (confidence: 0.99)
 * 2. Bank transfer code (confidence: 0.90)
 * 3. Amount+date fuzzy match (confidence: 0.55–0.85)
 * 4. Keyword detection (confidence: 0.60–0.75)
 * 5. AI fallback (for ambiguous cases)
 */

import type { Transaction, Account, DetectionMethod, NetValidationStatus } from '../types'

export interface TransferCandidate {
  debit_transaction_id: string
  credit_transaction_id: string
  amount: number
  currency: string
  detection_method: DetectionMethod
  detection_confidence: number
  from_account_id: string
  to_account_id: string
  booking_date: string
  net_difference: number
}

export interface TransferDetectionResult {
  transfer_pairs: TransferCandidate[]
  probable_transfers: string[] // transaction IDs that are likely transfers but no matching leg
}

/**
 * Detect inter-account transfers from a set of transactions
 */
export function detectTransfers(
  transactions: Transaction[],
  userAccounts: Account[]
): TransferDetectionResult {
  const userIBANs = new Set(
    userAccounts.map(a => a.iban).filter((iban): iban is string => iban !== null)
  )
  
  const accountIdToIBAN = new Map(
    userAccounts.map(a => [a.id, a.iban])
  )

  const transfer_pairs: TransferCandidate[] = []
  const probable_transfers: string[] = []
  const matched = new Set<string>()

  // Signal 1: IBAN Match (confidence: 0.99)
  for (const txn of transactions) {
    if (matched.has(txn.id)) continue

    const counterpartyIBAN = extractCounterpartyIBAN(txn)
    if (counterpartyIBAN && userIBANs.has(counterpartyIBAN)) {
      // Find matching transaction on the counterparty account
      const counterpartyAccountId = Array.from(userAccounts.values())
        .find(acc => acc.iban === counterpartyIBAN)?.id

      if (counterpartyAccountId) {
        const match = findMatchingTransaction(
          txn,
          transactions,
          counterpartyAccountId,
          matched
        )

        if (match) {
          const pair = createTransferPair(
            txn.amount < 0 ? txn : match,
            txn.amount > 0 ? txn : match,
            'iban_match',
            0.99
          )
          transfer_pairs.push(pair)
          matched.add(txn.id)
          matched.add(match.id)
          continue
        }
      }
    }

    // Signal 2: Bank Transfer Code (confidence: 0.90)
    if (hasBankTransferCode(txn)) {
      probable_transfers.push(txn.id)
    }
  }

  // Signal 3: Amount+Date Fuzzy Match (confidence: 0.55–0.85)
  const unmatched = transactions.filter(t => !matched.has(t.id))
  
  for (const debit of unmatched.filter(t => t.amount < 0)) {
    if (matched.has(debit.id)) continue

    const candidates = unmatched.filter(credit =>
      !matched.has(credit.id) &&
      credit.amount > 0 &&
      credit.account_id !== debit.account_id &&
      Math.abs(credit.amount + debit.amount) < 0.01 && // same absolute amount
      credit.currency === debit.currency &&
      isWithinDateWindow(debit.date, credit.date, 2) // ±2 days
    )

    if (candidates.length === 1) {
      const credit = candidates[0]
      const daysDiff = Math.abs(dateDiff(debit.date, credit.date))
      const confidence = daysDiff === 0 ? 0.85 : daysDiff === 1 ? 0.70 : 0.55

      if (confidence >= 0.70) {
        const pair = createTransferPair(debit, credit, 'amount_date_match', confidence)
        transfer_pairs.push(pair)
        matched.add(debit.id)
        matched.add(credit.id)
      }
    } else if (candidates.length > 1) {
      // Multiple candidates — rank by date proximity
      const sorted = candidates
        .map(c => ({
          transaction: c,
          daysDiff: Math.abs(dateDiff(debit.date, c.date)),
        }))
        .sort((a, b) => a.daysDiff - b.daysDiff)

      const best = sorted[0]
      const confidence = best.daysDiff === 0 ? 0.85 : best.daysDiff === 1 ? 0.70 : 0.55

      if (confidence >= 0.80) {
        const pair = createTransferPair(
          debit,
          best.transaction,
          'amount_date_match',
          confidence
        )
        transfer_pairs.push(pair)
        matched.add(debit.id)
        matched.add(best.transaction.id)
      }
    }
  }

  // Signal 4: Keyword Detection (confidence: 0.60–0.75)
  for (const txn of transactions) {
    if (matched.has(txn.id)) continue

    if (hasTransferKeywords(txn)) {
      probable_transfers.push(txn.id)
    }
  }

  return {
    transfer_pairs,
    probable_transfers: Array.from(new Set(probable_transfers)),
  }
}

/**
 * Validate net zero for a transfer pair
 */
export function validateNetZero(
  debitAmount: number,
  creditAmount: number
): {
  net_difference: number
  net_validation_status: NetValidationStatus
  fee_amount: number
} {
  const net = debitAmount + creditAmount
  const absNet = Math.abs(net)

  if (net === 0) {
    return {
      net_difference: 0,
      net_validation_status: 'confirmed_zero',
      fee_amount: 0,
    }
  }

  if (absNet <= 0.05) {
    return {
      net_difference: net,
      net_validation_status: 'confirmed_rounding',
      fee_amount: 0,
    }
  }

  if (absNet > 0 && absNet <= 5.00) {
    return {
      net_difference: net,
      net_validation_status: 'confirmed_with_fee',
      fee_amount: absNet,
    }
  }

  return {
    net_difference: net,
    net_validation_status: 'mismatch',
    fee_amount: 0,
  }
}

// ============================================
// Helper Functions
// ============================================

function extractCounterpartyIBAN(txn: Transaction): string | null {
  if (!txn.metadata) return null

  const meta = txn.metadata as any
  
  // Try creditor account (for debits)
  if (meta.creditorAccount?.iban) {
    return meta.creditorAccount.iban
  }

  // Try debtor account (for credits)
  if (meta.debtorAccount?.iban) {
    return meta.debtorAccount.iban
  }

  return null
}

function findMatchingTransaction(
  txn: Transaction,
  allTransactions: Transaction[],
  counterpartyAccountId: string,
  matched: Set<string>
): Transaction | null {
  return allTransactions.find(
    t =>
      !matched.has(t.id) &&
      t.id !== txn.id &&
      t.account_id === counterpartyAccountId &&
      Math.abs(t.amount + txn.amount) < 0.01 &&
      t.currency === txn.currency &&
      isWithinDateWindow(txn.date, t.date, 2)
  ) || null
}

function hasBankTransferCode(txn: Transaction): boolean {
  if (!txn.metadata) return false

  const meta = txn.metadata as any
  const bankCode = meta.bankTransactionCode?.toLowerCase() || ''
  const proprietary = meta.proprietaryBankTransactionCode?.toLowerCase() || ''

  return (
    bankCode === 'icdt' ||
    proprietary.includes('prevod') ||
    proprietary.includes('transfer') ||
    proprietary.includes('vlastny ucet') ||
    proprietary.includes('own account')
  )
}

function hasTransferKeywords(txn: Transaction): boolean {
  const description = (
    txn.original_description +
    ' ' +
    (txn.cleaned_description || '')
  ).toLowerCase()

  const keywords = [
    'prevod',
    'vlastný účet',
    'vlastny ucet',
    'sporenie',
    'úspory',
    'uspory',
    'transfer',
    'own account',
    'savings',
    'átutalás',
    'megtakarítás',
  ]

  return keywords.some(kw => description.includes(kw))
}

function isWithinDateWindow(date1: string, date2: string, days: number): boolean {
  const diff = Math.abs(dateDiff(date1, date2))
  return diff <= days
}

function dateDiff(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffMs = d2.getTime() - d1.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function createTransferPair(
  debit: Transaction,
  credit: Transaction,
  method: DetectionMethod,
  confidence: number
): TransferCandidate {
  const validation = validateNetZero(debit.amount, credit.amount)

  return {
    debit_transaction_id: debit.id,
    credit_transaction_id: credit.id,
    amount: Math.abs(debit.amount),
    currency: debit.currency,
    detection_method: method,
    detection_confidence: confidence,
    from_account_id: debit.account_id,
    to_account_id: credit.account_id,
    booking_date: debit.date,
    net_difference: validation.net_difference,
  }
}
