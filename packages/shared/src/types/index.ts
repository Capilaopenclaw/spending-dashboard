export * from './database'

// Additional shared types

export interface SpendingByCategory {
  category_id: string
  category_name: string
  category_icon: string
  category_color: string
  total_amount: number
  transaction_count: number
  percentage: number
}

export interface MonthlyTrend {
  month: string
  total_income: number
  total_expenses: number
  net: number
}

export interface BalanceSummary {
  total_balance: number
  total_available: number
  accounts: Array<{
    account_id: string
    account_name: string
    account_type: string
    current_balance: number
    available_balance: number
  }>
}

export interface TransferDetectionResult {
  transfer_pair_id: string
  debit_transaction_id: string
  credit_transaction_id: string
  confidence: number
  method: string
  net_validation: string
}

export interface GoCardlessInstitution {
  id: string
  name: string
  bic: string
  transaction_total_days: string
  countries: string[]
  logo: string
}

export interface GoCardlessRequisition {
  id: string
  status: string
  redirect: string
  link: string
  accounts: string[]
  agreement: string
  institution_id: string
}

export interface GoCardlessAccount {
  id: string
  iban: string
  currency: string
  ownerName: string
  status: string
}

export interface GoCardlessTransaction {
  transactionId: string
  bookingDate: string
  valueDate?: string
  transactionAmount: {
    amount: string
    currency: string
  }
  creditorName?: string
  creditorAccount?: { iban: string }
  debtorName?: string
  debtorAccount?: { iban: string }
  remittanceInformationUnstructured?: string
  bankTransactionCode?: string
  proprietaryBankTransactionCode?: string
}

export interface GoCardlessBalance {
  balanceAmount: {
    amount: string
    currency: string
  }
  balanceType: string
  referenceDate: string
}
