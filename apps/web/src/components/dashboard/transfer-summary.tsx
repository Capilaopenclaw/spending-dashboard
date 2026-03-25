'use client'

import { useTransferTotal } from '@/lib/queries'
import { formatCurrency, t } from '@spending-dashboard/shared'
import { ArrowLeftRight } from 'lucide-react'

export function TransferSummary({ language }: { language: 'sk' | 'en' | 'hu' }) {
  const { data: total } = useTransferTotal()

  if (!total || total === 0) return null

  return (
    <div className="flex items-center gap-2 rounded-lg bg-bg-elevated/50 px-4 py-2 text-sm text-text-secondary">
      <ArrowLeftRight size={14} />
      <span>{t('dashboard.transfers', language)}:</span>
      <span className="tabular-nums font-medium">{formatCurrency(total)}</span>
    </div>
  )
}
