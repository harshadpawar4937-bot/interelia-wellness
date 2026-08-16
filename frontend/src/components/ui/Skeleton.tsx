import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <Skeleton className="aspect-square w-full shrink-0 rounded-lg" />
      <div className="mt-3 flex flex-1 flex-col">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-1 h-11 w-full" />
        <Skeleton className="mt-1 h-4 w-1/2" />
        <Skeleton className="mt-2 h-5 w-2/3" />
        <Skeleton className="mt-2 h-7 w-1/3" />
        <Skeleton className="mt-auto h-9 w-full rounded-md" />
      </div>
    </div>
  )
}
