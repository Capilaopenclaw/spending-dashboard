'use client'

import { useAppStore } from '@/lib/store'
import { useInsights, useDismissInsight } from '@/lib/queries'
import { t } from '@spending-dashboard/shared'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Lightbulb, AlertTriangle, TrendingUp, X, Eye } from 'lucide-react'

const severityConfig = {
  info: { icon: Lightbulb, bg: 'bg-accent-secondary/10', border: 'border-accent-secondary/20', text: 'text-accent-secondary', label: 'Info' },
  warning: { icon: AlertTriangle, bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', label: 'Pozor' },
  positive: { icon: TrendingUp, bg: 'bg-positive/10', border: 'border-positive/20', text: 'text-positive', label: 'Pozitívne' },
}

export default function InsightsPage() {
  const language = useAppStore((s) => s.language)
  const { data: insights, isLoading } = useInsights()
  const dismiss = useDismissInsight()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t('insights.title', language)}</h1>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-card" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('insights.title', language)}</h1>

      {(insights ?? []).length === 0 ? (
        <Card className="py-12 text-center">
          <Eye size={32} className="mx-auto mb-3 text-text-secondary" />
          <div className="text-text-secondary">
            {language === 'sk' ? 'Zatiaľ žiadne prehľady. Pridaj banku a počkaj na prvú analýzu.' : 'No insights yet. Connect a bank and wait for the first analysis.'}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {(insights ?? []).map((insight) => {
            const config = severityConfig[insight.severity] ?? severityConfig.info
            const Icon = config.icon
            const title = language === 'sk' ? insight.title_sk : language === 'hu' ? insight.title_hu : insight.title_en
            const message = language === 'sk' ? insight.message_sk : language === 'hu' ? insight.message_hu : insight.message_en

            return (
              <Card
                key={insight.id}
                className={cn(config.bg, 'border', config.border, 'relative')}
              >
                <button
                  onClick={() => dismiss.mutate(insight.id)}
                  className="absolute right-4 top-4 text-text-secondary hover:text-text-primary"
                >
                  <X size={14} />
                </button>
                <div className="flex items-start gap-3">
                  <Icon size={20} className={cn(config.text, 'mt-0.5 flex-shrink-0')} />
                  <div className="pr-6">
                    <div className={cn('text-sm font-semibold', config.text)}>{title}</div>
                    <div className="text-sm text-text-secondary mt-1 leading-relaxed">{message}</div>
                    <div className="text-xs text-text-secondary/60 mt-2">
                      {new Date(insight.created_at).toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US')}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
