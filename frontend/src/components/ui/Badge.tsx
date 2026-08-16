import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'success' | 'neutral' | 'warning'
}

export function Badge({ className, variant = 'brand', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
        variant === 'brand' && 'bg-brand text-white',
        variant === 'success' && 'bg-success/10 text-success',
        variant === 'neutral' && 'bg-surface-secondary text-ink-muted',
        variant === 'warning' && 'bg-warning/10 text-warning',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
