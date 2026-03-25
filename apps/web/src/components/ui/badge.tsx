import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'positive' | 'negative' | 'warning' | 'info'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-bg-elevated text-text-secondary',
    positive: 'bg-positive/15 text-positive',
    negative: 'bg-negative/15 text-negative',
    warning: 'bg-warning/15 text-warning',
    info: 'bg-accent-secondary/15 text-accent-secondary',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
