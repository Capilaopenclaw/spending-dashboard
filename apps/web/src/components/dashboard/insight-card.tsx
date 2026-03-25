'use client'

import { Card } from '@/components/ui/card'
import { useInsights, useDismissInsight } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { X, Lightbulb, AlertTriangle, TrendingUp } from 'lucide-react'

export function InsightCard({ language }: { language: 'sk' | 'en' | 'hu' }) {
  const { data: insights } = useInsights()
  const dismiss = useDismissInsight()

  const latest = insights?.[0]
  if (!latest) return null

  const title = language === 'sk' ? latest.title_sk : language === 'hu' ? latest.title_hu : latest.title_en
  const message = language === 'sk' ? latest.message_sk : language === 'hu' ? latest.message_hu : latest.message_en

  const severityConfig = {
    info: { icon: Lightbulb, bg: 'bg-accent-secondary/10', border: 'border-accent-secondary/20', text: 'text-accent-secondary' },
    warning: { icon: AlertTriangle, bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning' },
    positive: { icon: TrendingUp, bg: 'bg-positive/10', border: 'border-positive/20', text: 'text-positive' },
  }

  const config = severityConfig[latest.severity] ?? severityConfig.info
  const Icon = config.icon

  return (
    <Card className={cn(config.bg, 'border', config.border, 'relative')}>
      <button
        onClick={() => dismiss.mutate(latest.id)}
        className="absolute right-3 top-3 text-text-secondary hover:text-text-primary"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3">
        <Icon size={18} className={cn(config.text, 'mt-0.5 flex-shrink-0')} />
        <div>
          <div className={cn('text-sm font-semibold', config.text)}>{title}</div>
          <div className="text-xs text-text-secondary mt-1">{message}</div>
        </div>
      </div>
    </Card>
  )
}
