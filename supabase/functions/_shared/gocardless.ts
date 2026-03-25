/**
 * GoCardless Bank Account Data API client
 * Base URL: https://bankaccountdata.gocardless.com
 * All token management is server-side only.
 */

const GC_BASE_URL = 'https://bankaccountdata.gocardless.com'

export interface GCTokens {
  access: string
  access_expires: number // seconds
  refresh: string
  refresh_expires: number // seconds
}

export interface GCInstitution {
  id: string
  name: string
  bic: string
  transaction_total_days: string
  countries: string[]
  logo: string
}

export interface GCRequisition {
  id: string
  created: string
  redirect: string
  status: string
  institution_id: string
  agreement: string
  reference: string
  accounts: string[]
  link: string
}

export interface GCAgreement {
  id: string
  created: string
  institution_id: string
  max_historical_days: number
  access_valid_for_days: number
  access_scope: string[]
  accepted: string | null
}

export interface GCAccountDetails {
  iban?: string
  currency?: string
  ownerName?: string
  name?: string
  product?: string
  cashAccountType?: string
}

export interface GCBalance {
  balanceAmount: { amount: string; currency: string }
  balanceType: string
  referenceDate?: string
}

export interface GCTransaction {
  transactionId?: string
  internalTransactionId?: string
  bookingDate?: string
  valueDate?: string
  transactionAmount: { amount: string; currency: string }
  creditorName?: string
  creditorAccount?: { iban?: string }
  debtorName?: string
  debtorAccount?: { iban?: string }
  remittanceInformationUnstructured?: string
  remittanceInformationUnstructuredArray?: string[]
  bankTransactionCode?: string
  proprietaryBankTransactionCode?: string
  additionalInformation?: string
}

class GoCardlessError extends Error {
  constructor(public status: number, public detail: string) {
    super(`GoCardless API error ${status}: ${detail}`)
    this.name = 'GoCardlessError'
  }
}

async function gcFetch<T>(
  path: string,
  options: {
    method?: string
    body?: unknown
    accessToken?: string
  } = {}
): Promise<T> {
  const { method = 'GET', body, accessToken } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${GC_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new GoCardlessError(res.status, text)
  }

  return res.json()
}

// ======== Token Management ========

export async function createToken(secretId: string, secretKey: string): Promise<GCTokens> {
  return gcFetch<GCTokens>('/api/v2/token/new/', {
    method: 'POST',
    body: { secret_id: secretId, secret_key: secretKey },
  })
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access: string; access_expires: number }> {
  return gcFetch('/api/v2/token/refresh/', {
    method: 'POST',
    body: { refresh: refreshToken },
  })
}

// ======== Institutions ========

export async function listInstitutions(accessToken: string, country: string): Promise<GCInstitution[]> {
  return gcFetch<GCInstitution[]>(`/api/v2/institutions/?country=${country}`, {
    accessToken,
  })
}

// ======== Agreements ========

export async function createAgreement(
  accessToken: string,
  institutionId: string,
  maxHistoricalDays: number = 730,
  accessValidForDays: number = 90
): Promise<GCAgreement> {
  return gcFetch<GCAgreement>('/api/v2/agreements/enduser/', {
    method: 'POST',
    accessToken,
    body: {
      institution_id: institutionId,
      max_historical_days: maxHistoricalDays,
      access_valid_for_days: accessValidForDays,
      access_scope: ['balances', 'details', 'transactions'],
    },
  })
}

// ======== Requisitions ========

export async function createRequisition(
  accessToken: string,
  institutionId: string,
  redirectUrl: string,
  agreementId: string,
  reference: string,
  userLanguage: string = 'SK'
): Promise<GCRequisition> {
  return gcFetch<GCRequisition>('/api/v2/requisitions/', {
    method: 'POST',
    accessToken,
    body: {
      institution_id: institutionId,
      redirect: redirectUrl,
      agreement: agreementId,
      reference,
      user_language: userLanguage,
    },
  })
}

export async function getRequisition(accessToken: string, requisitionId: string): Promise<GCRequisition> {
  return gcFetch<GCRequisition>(`/api/v2/requisitions/${requisitionId}/`, { accessToken })
}

export async function deleteRequisition(accessToken: string, requisitionId: string): Promise<void> {
  await gcFetch(`/api/v2/requisitions/${requisitionId}/`, {
    method: 'DELETE',
    accessToken,
  })
}

// ======== Accounts ========

export async function getAccountDetails(accessToken: string, accountId: string): Promise<{ account: GCAccountDetails }> {
  return gcFetch(`/api/v2/accounts/${accountId}/details/`, { accessToken })
}

export async function getAccountBalances(accessToken: string, accountId: string): Promise<{ balances: GCBalance[] }> {
  return gcFetch(`/api/v2/accounts/${accountId}/balances/`, { accessToken })
}

export async function getAccountTransactions(
  accessToken: string,
  accountId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ transactions: { booked: GCTransaction[]; pending: GCTransaction[] } }> {
  let path = `/api/v2/accounts/${accountId}/transactions/`
  const params: string[] = []
  if (dateFrom) params.push(`date_from=${dateFrom}`)
  if (dateTo) params.push(`date_to=${dateTo}`)
  if (params.length) path += `?${params.join('&')}`

  return gcFetch(path, { accessToken })
}
