import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RatingStarsProps {
  rating: number
  size?: 'sm' | 'md'
  showValue?: boolean
  count?: number
  className?: string
}

export function RatingStars({ rating, size = 'sm', showValue, count, className }: RatingStarsProps) {
  const starSize = size === 'sm' ? 14 : 18
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={starSize}
            className={cn(
              i < Math.round(rating) ? 'fill-brand text-brand' : 'fill-border text-border',
            )}
          />
        ))}
      </div>
      {showValue && <span className="text-sm font-medium text-ink">{rating.toFixed(1)}</span>}
      {count !== undefined && (
        <span className="text-sm text-ink-muted">({count.toLocaleString('en-IN')})</span>
      )}
    </div>
  )
}
