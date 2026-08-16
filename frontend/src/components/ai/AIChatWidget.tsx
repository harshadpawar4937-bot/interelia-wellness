import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Send, X, Minimize2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ChatMessage } from '@/types'
import { Button } from '@/components/ui/Button'

const quickReplies = ['Fever', 'Headache', 'Acidity', 'Cough', 'Upload prescription']

type AskResult = { reply: string; productLinks: string[] }

async function askApi(message: string): Promise<AskResult> {
  const base = import.meta.env.VITE_API_URL ?? ''
  const res = await fetch(`${base}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = typeof err.detail === 'string' ? err.detail : 'Request failed'
    throw new Error(detail)
  }
  const data = (await res.json()) as {
    reply: string
    products?: { name: string; slug: string }[]
  }
  const productLinks = (data.products || [])
    .slice(0, 3)
    .map((p) => `${p.name} → /product/${p.slug}`)
  return { reply: data.reply, productLinks }
}

/** Floating AI health assistant chatbot */
export function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm0',
      role: 'assistant',
      content:
        'Hello! I recommend in-stock Interelia Wellness medicines for your need. Ask about fever, acidity, cough, and more — always consult a healthcare professional for medical decisions.',
      timestamp: new Date().toISOString(),
    },
  ])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setBusy(true)
    try {
      if (/prescription|upload rx/i.test(trimmed)) {
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: 'Upload your prescription at /prescription for pharmacist review.',
            timestamp: new Date().toISOString(),
          },
        ])
        return
      }
      const { reply, productLinks } = await askApi(trimmed)
      let content = reply
      if (productLinks.length) {
        content += `\n\nRecommended:\n${productLinks.map((l) => `• ${l}`).join('\n')}`
      }
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Network error'
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: `Could not reach the AI service (${detail}). Open the full AI Assistant page or try again shortly.`,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed bottom-24 right-4 z-50 flex h-[min(520px,70vh)] w-[min(100%-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-lift sm:right-6"
          >
            <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Bot size={20} />
                <div>
                  <p className="font-display text-sm font-semibold">AI Health Assistant</p>
                  <p className="text-[11px] text-white/80">Inventory-grounded · Not a doctor</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Link to="/ai-assistant" className="rounded p-1.5 hover:bg-white/10" title="Full page">
                  <Minimize2 size={16} />
                </Link>
                <button type="button" onClick={() => setOpen(false)} className="rounded p-1.5 hover:bg-white/10" aria-label="Close chat">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'rounded-br-md bg-brand text-white'
                        : 'rounded-bl-md bg-surface-secondary text-ink'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {quickReplies.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:border-brand hover:text-brand"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void send(input)
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your need…"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
                  disabled={busy}
                />
                <Button type="submit" size="sm" aria-label="Send" disabled={busy}>
                  <Send size={16} />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lift sm:right-6"
        aria-label="Open AI Health Assistant"
      >
        {open ? <X size={22} /> : <Bot size={24} />}
      </motion.button>
    </>
  )
}
