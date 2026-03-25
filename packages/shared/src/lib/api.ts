// API client for Supabase Edge Functions

export interface ApiClientConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  accessToken?: string
}

export class ApiClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(config: ApiClientConfig) {
    this.baseUrl = `${config.supabaseUrl}/functions/v1`
    this.headers = {
      'Content-Type': 'application/json',
      apikey: config.supabaseAnonKey,
    }
    if (config.accessToken) {
      this.headers['Authorization'] = `Bearer ${config.accessToken}`
    }
  }

  setAccessToken(token: string) {
    this.headers['Authorization'] = `Bearer ${token}`
  }

  private async request<T>(fn: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${fn}`, {
      ...options,
      headers: { ...this.headers, ...options?.headers },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error')
      throw new Error(`API error ${res.status}: ${text}`)
    }
    return res.json()
  }

  // GoCardless
  async getInstitutions(country: string = 'sk') {
    return this.request<any[]>(`gc-institutions?country=${country}`)
  }

  async connectBank(institutionId: string, redirectUrl: string) {
    return this.request<{ auth_link: string; requisition_id: string }>('gc-connect-bank', {
      method: 'POST',
      body: JSON.stringify({ institution_id: institutionId, redirect_url: redirectUrl }),
    })
  }

  async finalizeBankConnection(requisitionId: string) {
    return this.request<{ status: string; accounts_created: number }>('gc-callback', {
      method: 'POST',
      body: JSON.stringify({ requisition_id: requisitionId }),
    })
  }

  async disconnectBank(connectionId: string) {
    return this.request<{ success: boolean }>('gc-disconnect-bank', {
      method: 'POST',
      body: JSON.stringify({ connection_id: connectionId }),
    })
  }

  async syncAll() {
    return this.request<{ 
      success: boolean; 
      connections_synced: number; 
      total_accounts_synced: number; 
      total_transactions_added: number; 
      results: any[] 
    }>('gc-sync-all', { method: 'POST' })
  }

  // AI
  async categorizeTransactions(transactionIds?: string[]) {
    return this.request<{ 
      success: boolean; 
      categorized: number; 
      total_uncategorized: number 
    }>('ai-categorize', {
      method: 'POST',
      body: JSON.stringify({ transaction_ids: transactionIds }),
    })
  }

  async getInsights() {
    return this.request<{ 
      success: boolean; 
      insights_created: number; 
      results?: any[] 
    }>('ai-insights', { method: 'POST' })
  }

  // AI Chat — returns ReadableStream for SSE
  async chatStream(message: string): Promise<ReadableStream<Uint8Array> | null> {
    const res = await fetch(`${this.baseUrl}/ai-chat`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ message, stream: true }),
    })
    if (!res.ok) throw new Error(`Chat error ${res.status}`)
    return res.body
  }

  async chat(message: string) {
    return this.request<{ reply: string; message_id: string }>('ai-chat', {
      method: 'POST',
      body: JSON.stringify({ message, stream: false }),
    })
  }

  // Transfer management
  async confirmTransfer(transferPairId: string) {
    return this.request<{ success: boolean }>('detect-transfers', {
      method: 'POST',
      body: JSON.stringify({ action: 'confirm', transfer_pair_id: transferPairId }),
    })
  }

  async rejectTransfer(transferPairId: string) {
    return this.request<{ success: boolean }>('detect-transfers', {
      method: 'POST',
      body: JSON.stringify({ action: 'reject', transfer_pair_id: transferPairId }),
    })
  }

  async manualPairTransfer(debitTxId: string, creditTxId: string) {
    return this.request<{ success: boolean; transfer_pair_id: string }>('detect-transfers', {
      method: 'POST',
      body: JSON.stringify({ action: 'manual_pair', debit_transaction_id: debitTxId, credit_transaction_id: creditTxId }),
    })
  }
}
