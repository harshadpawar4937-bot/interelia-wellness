import { useQuery } from '@tanstack/react-query'
import { api, mapApiProduct, type ApiProduct } from '@/lib/api'
import { ProductCard } from '@/components/product/ProductCard'
import { useQuickViewStore } from '@/store/quickViewStore'

interface RailResponse {
  key: string
  title: string
  subtitle: string | null
  items: ApiProduct[]
}

export function MerchProductRail({ railKey }: { railKey: 'latest' | 'trending' }) {
  const openQuickView = useQuickViewStore((s) => s.open)
  const { data } = useQuery({
    queryKey: ['home-rail', railKey],
    queryFn: () => api<RailResponse>(`/api/v1/content/rails/${railKey}`),
    retry: 1,
  })

  const products = (data?.items || []).map(mapApiProduct).filter((p) => p.inStock)
  if (!products.length) return null

  return (
    <section className="container-brand py-10 lg:py-14" aria-label={data?.title || railKey}>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{data?.title}</h2>
        {data?.subtitle && <p className="mt-2 text-ink-muted">{data.subtitle}</p>}
      </div>
      <div className="flex items-stretch gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((p, i) => (
          <div key={p.id} className="flex w-[46%] shrink-0 sm:w-[30%] lg:w-[22%]">
            <div
              role="button"
              tabIndex={0}
              className="flex h-full w-full flex-col"
              onClick={(e) => {
                // Allow ATC / wishlist buttons inside card to work; open QV when clicking image area via card link intercept
                const t = e.target as HTMLElement
                if (t.closest('button') || t.closest('a')) return
                openQuickView(Number(p.id))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') openQuickView(Number(p.id))
              }}
            >
              <ProductCard product={p} index={i} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
