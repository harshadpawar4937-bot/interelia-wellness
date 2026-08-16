import { useState, useRef, useEffect } from 'react'
import { Bot, Send } from 'lucide-react'
import type { ChatMessage, Product } from '@/types'
import { Button } from '@/components/ui/Button'
import { api, mapApiProduct, type ApiProduct } from '@/lib/api'
import { Link } from 'react-router-dom'
import { formatPrice } from '@/lib/utils'

type ChatBubble = ChatMessage & { products?: Product[] }

export function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Welcome to the Interelia AI Health Assistant. Describe your need (e.g. fever, acidity, cough) and I will recommend the best matching in-stock medicines from our pharmacy. Educational only — not medical advice.',
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastMatched, setLastMatched] = useState<Product[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const t = input.trim()
    if (!t || loading) return
    setInput('')
    setHasSearched(true)
    setMessages((m) => [
      ...m,
      { id: `u${Date.now()}`, role: 'user', content: t, timestamp: new Date().toISOString() },
    ])
    setLoading(true)
    try {
      const res = await api<{
        reply: string
        citations?: { slug?: string; title?: string; type?: string }[]
        products?: ApiProduct[]
      }>('/api/v1/ai/chat', { method: 'POST', body: JSON.stringify({ message: t }) })
      let content = res.reply
      if (res.citations?.length) {
        const links = res.citations
          .filter((c) => c.slug)
          .map((c) => c.title)
          .slice(0, 5)
          .join(' · ')
        if (links) content += `\n\nMatched inventory: ${links}`
      }
      const matched = (res.products || []).map(mapApiProduct).filter((p) => p.inStock)
      setLastMatched(matched)
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
          products: matched,
        },
      ])
    } catch (err) {
      setLastMatched([])
      const detail = err instanceof Error ? err.message : 'unknown error'
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: 'assistant',
          content: `AI service temporarily unavailable (${detail}). Check that the API is running on port 8001, then try again.`,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // After a search: only related in-stock inventory matches. Before search: empty prompt.
  const sidebarProducts = hasSearched ? lastMatched.slice(0, 8) : []

  return (
    <div className="container-brand py-8 lg:py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white">
          <Bot size={28} />
        </div>
        <h1 className="font-display text-3xl font-bold">AI Health Assistant</h1>
        <p className="mx-auto mt-2 max-w-xl text-ink-muted">
          Pharmacist-style recommendations from our live in-stock inventory only.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border border-border">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] space-y-2">
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === 'user' ? 'bg-brand text-white' : 'bg-surface-secondary'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.products && m.products.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {m.products.slice(0, 4).map((p) => (
                        <Link
                          key={p.id}
                          to={`/product/${p.slug}`}
                          className="flex gap-2 rounded-lg border border-border bg-white p-2 text-left hover:border-brand"
                        >
                          <img src={p.image} alt="" className="h-10 w-10 rounded object-cover" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{p.name}</p>
                            <p className="text-xs text-brand">{formatPrice(p.price)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
            className="flex gap-2 border-t border-border p-4"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. fever, headache, acidity, cough…"
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm outline-none focus:border-brand"
            />
            <Button type="submit" disabled={loading}>
              <Send size={16} />
            </Button>
          </form>
        </div>

        <aside>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {hasSearched ? 'Related from inventory' : 'Related products'}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {hasSearched
              ? 'In-stock matches for your latest question'
              : 'Ask about a symptom or medicine to see matching stock here'}
          </p>
          <ul className="mt-3 space-y-3">
            {!hasSearched && (
              <li className="rounded-lg border border-dashed border-border p-3 text-xs text-ink-muted">
                Try “fever”, “headache”, or “acidity” to load related available products.
              </li>
            )}
            {hasSearched && sidebarProducts.length === 0 && (
              <li className="rounded-lg border border-dashed border-border p-3 text-xs text-ink-muted">
                No in-stock matches for that question.{' '}
                <Link to="/shop" className="text-brand hover:underline">
                  Browse shop
                </Link>
              </li>
            )}
            {sidebarProducts.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/product/${p.slug}`}
                  className="flex gap-3 rounded-lg border border-border p-2 hover:border-brand"
                >
                  <img src={p.image} alt="" className="h-12 w-12 rounded object-cover" />
                  <div>
                    <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-brand">{formatPrice(p.price)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ink-muted">
                      {p.requiresPrescription ? 'Rx' : 'In stock'}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
