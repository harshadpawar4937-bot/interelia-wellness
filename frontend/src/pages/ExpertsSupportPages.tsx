import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Clock, MapPin, MessageCircle, Navigation, Phone, Stethoscope } from 'lucide-react'
import { experts as fallbackExperts } from '@/data/catalog'
import {
  api,
  API_URL,
  buildMapsUrl,
  expertAddressLines,
  mapApiExpert,
  telHref,
  waHref,
  type ApiExpert,
} from '@/lib/api'
import type { Expert } from '@/types'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

function mediaUrl(path?: string | null) {
  if (!path) return undefined
  if (path.startsWith('http') || path.startsWith('data:')) return path
  return `${API_URL}${path}`
}

function ExpertCard({ expert, index }: { expert: Expert; index: number }) {
  const callHref = expert.acceptingCalls !== false ? telHref(expert.phone) : null
  const chatHref = waHref(expert.whatsapp || expert.phone)
  const mapsHref = buildMapsUrl(expert)
  const address = expertAddressLines(expert)
  const canVisit = expert.acceptingVisits !== false && (address.length > 0 || !!mapsHref)

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.24) }}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-soft"
    >
      <div className="flex gap-4 border-b border-border/70 bg-gradient-to-br from-brand-soft/40 via-white to-surface-secondary/50 p-5 sm:p-6">
        <img
          src={mediaUrl(expert.image) || expert.image}
          alt={expert.name}
          className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-white shadow-sm sm:h-24 sm:w-24"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold leading-tight text-ink">{expert.name}</h2>
          <p className="mt-1 text-sm font-medium text-brand">{expert.role}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{expert.specialty}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {callHref && (
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand ring-1 ring-brand/20">
                Call available
              </span>
            )}
            {canVisit && (
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted ring-1 ring-border">
                In-clinic
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        {expert.quote && (
          <p className="text-sm italic leading-relaxed text-ink-muted">&ldquo;{expert.quote}&rdquo;</p>
        )}
        {expert.bio && <p className="text-sm leading-relaxed text-ink">{expert.bio}</p>}

        {(address.length > 0 || expert.availabilityText) && (
          <div className="rounded-xl bg-surface-secondary/70 p-4">
            {address.length > 0 && (
              <div className="flex gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brand" />
                <div className="min-w-0 text-sm leading-snug text-ink">
                  {address.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            )}
            {expert.availabilityText && (
              <div className={`flex gap-2.5 ${address.length ? 'mt-3' : ''}`}>
                <Clock size={16} className="mt-0.5 shrink-0 text-brand" />
                <p className="text-sm text-ink">{expert.availabilityText}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto grid gap-2 sm:grid-cols-2">
          {callHref ? (
            <a
              href={callHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand/90"
            >
              <Phone size={16} />
              Call expert
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface-secondary px-4 text-sm font-medium text-ink-muted">
              <Phone size={16} />
              Calls unavailable
            </span>
          )}

          {mapsHref && canVisit ? (
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand"
            >
              <Navigation size={16} />
              Get directions
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 text-sm font-medium text-ink-muted">
              <MapPin size={16} />
              Address coming soon
            </span>
          )}

          {chatHref && (
            <a
              href={chatHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand sm:col-span-2"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </motion.article>
  )
}

export function ExpertsPage() {
  const [specialty, setSpecialty] = useState<string>('all')

  const { data, isLoading, isError, refetch, isSuccess } = useQuery({
    queryKey: ['experts'],
    queryFn: async () => {
      const rows = await api<ApiExpert[]>('/api/v1/content/experts')
      return rows.map(mapApiExpert)
    },
    staleTime: 60_000,
  })

  // Only use hardcoded catalog fallback in local/dev when the API is unreachable.
  const list =
    data && data.length > 0
      ? data
      : isError && import.meta.env.DEV
        ? fallbackExperts
        : data ?? []

  const specialties = useMemo(() => {
    const set = new Set(list.map((e) => e.specialty).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [list])

  const filtered = useMemo(() => {
    if (specialty === 'all') return list
    return list.filter((e) => e.specialty === specialty)
  }, [list, specialty])

  const showEmpty = !isLoading && isSuccess && filtered.length === 0 && !isError

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,_rgba(229,43,64,0.12),_transparent_55%),linear-gradient(180deg,#fff_0%,#faf7f8_45%,#fff_100%)]"
      />

      <div className="container-brand relative py-10 lg:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            <Stethoscope size={14} />
            Expert corner
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Meet specialists you can visit — or call
          </h1>
          <p className="mt-3 text-ink-muted">
            Curated doctors and wellness experts. Prefer not to travel? Tap Call or WhatsApp for direct
            guidance. Prefer in-person? Open directions to the clinic.
          </p>
        </div>

        {!isLoading && specialties.length > 2 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {specialties.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpecialty(s)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                  specialty === s
                    ? 'bg-brand text-white'
                    : 'bg-white text-ink-muted ring-1 ring-border hover:text-brand'
                }`}
              >
                {s === 'all' ? 'All specialties' : s}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        )}

        {isError && (
          <p className="mt-8 text-center text-sm text-ink-muted">
            Showing saved experts while we reconnect.{' '}
            <button type="button" className="font-medium text-brand underline" onClick={() => void refetch()}>
              Retry
            </button>
          </p>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {filtered.map((ex, i) => (
              <ExpertCard key={ex.id} expert={ex} index={i} />
            ))}
          </div>
        )}

        {showEmpty && (
          <div className="mt-16 rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
            <Stethoscope className="mx-auto text-brand" size={32} />
            <p className="mt-4 font-display text-lg font-semibold">
              {specialty === 'all' ? 'Experts coming soon' : 'No experts in this specialty yet'}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {specialty === 'all'
                ? 'Our specialist network is being updated. Please check back shortly.'
                : 'Try another filter or check back soon.'}
            </p>
            {specialty !== 'all' && (
              <button
                type="button"
                className="mt-4 text-sm font-medium text-brand underline"
                onClick={() => setSpecialty('all')}
              >
                Show all experts
              </button>
            )}
          </div>
        )}

        <div className="mt-14 rounded-2xl border border-border bg-white p-6 text-center sm:p-8">
          <h2 className="font-display text-xl font-bold">Prefer reading first?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted">
            Browse health guides written with the same specialist network — then call an expert when you
            are ready.
          </p>
          <Link to="/health" className="mt-5 inline-block">
            <Button>Read expert articles</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

export function SupportPage() {
  const faqs = [
    {
      q: 'How do I upload a prescription?',
      a: 'Go to Upload Rx, attach a clear photo or PDF. OCR extracts medicines, then a pharmacist verifies before you can order.',
    },
    {
      q: 'Are products authentic?',
      a: 'Yes. Interelia Wellness sources from licensed partners only. Look for our Authentic Products trust badge.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'Razorpay supports UPI, credit/debit cards, net banking, and popular wallets.',
    },
    {
      q: 'How do returns work?',
      a: 'Eligible items can be returned within policy windows. Medicines may have special restrictions — see Returns & Refunds.',
    },
  ]

  return (
    <div className="container-brand py-8 lg:py-12">
      <h1 className="font-display text-3xl font-bold">Support center</h1>
      <p className="mt-2 text-ink-muted">Tickets, callbacks, WhatsApp, and FAQs — we are here for you.</p>

      <div id="contact" className="mt-10 grid gap-6 lg:grid-cols-3">
        {[
          { t: 'WhatsApp', d: 'Order & Rx updates on WhatsApp' },
          { t: 'Callback', d: 'Request a call from our care team' },
          { t: 'Ticket', d: 'Trackable support for complex issues' },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-border p-6">
            <h2 className="font-display font-semibold">{c.t}</h2>
            <p className="mt-2 text-sm text-ink-muted">{c.d}</p>
            <Button size="sm" className="mt-4" variant="outline">
              Start
            </Button>
          </div>
        ))}
      </div>

      <section id="faq" className="mt-14">
        <h2 className="font-display text-xl font-bold">FAQs</h2>
        <ul className="mt-4 space-y-3">
          {faqs.map((f) => (
            <li key={f.q} className="rounded-xl border border-border p-5">
              <h3 className="font-semibold">{f.q}</h3>
              <p className="mt-2 text-sm text-ink-muted">{f.a}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="returns" className="mt-14 rounded-xl bg-surface-secondary p-6">
        <h2 className="font-display text-lg font-bold">Returns & refunds</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Damaged or incorrect items are eligible for return. Prescription medicines follow regulatory guidelines.
          Refunds are processed to the original payment method within 5–7 business days after approval.
        </p>
      </section>
    </div>
  )
}

export function LegalPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="container-brand py-12">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  )
}
