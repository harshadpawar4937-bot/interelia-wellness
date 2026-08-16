import { Timer } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function ExpressDeliveryBadge({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['delivery-config'],
    queryFn: () =>
      api<{ promise: string; radius_km: number; eta_minutes: number }>('/api/v1/delivery/config'),
    staleTime: 60_000,
    retry: 1,
  })

  const label =
    data?.promise ||
    `Express within ${data?.radius_km ?? 6} km · ${data?.eta_minutes ?? 30} min`

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success',
        className,
      )}
    >
      <Timer size={14} />
      {label}
    </span>
  )
}
