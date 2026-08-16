import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface AIConfig {
  fine_tuned_model_id: string | null
  base_model: string
  last_train_status: string | null
  chunk_count: number
}

export function AIPage() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const [message, setMessage] = useState('I have fever — what medicine should I take?')
  const [reply, setReply] = useState('')
  const [modelId, setModelId] = useState('')

  const { data } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => api<AIConfig>('/api/v1/admin/ai/config', { token }),
  })

  const reindex = useMutation({
    mutationFn: () => api<{ chunks: number }>('/api/v1/admin/ai/reindex', { method: 'POST', token }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['ai-config'] })
      alert(`Reindexed ${r.chunks} chunks`)
    },
  })

  const chat = useMutation({
    mutationFn: () =>
      api<{ reply: string; mode: string; model: string; products?: { name: string }[] }>(
        '/api/v1/admin/ai/chat-test',
        {
          method: 'POST',
          token,
          body: JSON.stringify({ message }),
        },
      ),
    onSuccess: (r) => {
      const names = (r.products || []).map((p) => p.name).slice(0, 5).join(', ')
      setReply(
        `[${r.mode} · ${r.model}]\n\n${r.reply}${names ? `\n\nProducts: ${names}` : ''}`,
      )
    },
  })

  const setModel = useMutation({
    mutationFn: () =>
      api(`/api/v1/admin/ai/set-model?model_id=${encodeURIComponent(modelId)}`, {
        method: 'POST',
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-config'] }),
  })

  const docsUrl =
    (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ||
    'http://127.0.0.1:8001'

  return (
    <div className="admin-page flex min-h-[calc(100dvh-7rem)] flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="admin-page-title">AI Knowledge</h1>
          <p className="admin-page-sub">
            RAG index over live products & content, plus fine-tuned model config and chat testing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => reindex.mutate()}
            disabled={reindex.isPending}
          >
            {reindex.isPending ? 'Rebuilding…' : 'Rebuild index from catalog'}
          </button>
          <a className="admin-btn admin-btn-secondary" href={`${docsUrl}/api/docs`} target="_blank" rel="noreferrer">
            API docs
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="admin-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Chunks indexed</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">
            {(data?.chunk_count ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="admin-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Base model</p>
          <p className="mt-2 font-display text-xl font-bold break-all">{data?.base_model || '—'}</p>
        </div>
        <div className="admin-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Fine-tuned model</p>
          <p className="mt-2 text-base font-semibold break-all">
            {data?.fine_tuned_model_id || 'Not set'}
          </p>
        </div>
      </div>

      <div className="grid flex-1 gap-6 xl:grid-cols-2 xl:items-stretch">
        <section className="admin-panel flex flex-col">
          <h2 className="font-display text-lg font-semibold">Set fine-tuned model ID</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Paste a fine-tune ID after training. Leave empty until you have one.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="admin-input flex-1"
              placeholder="ft:gpt-4o-mini:interelia:..."
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            />
            <button
              type="button"
              className="admin-btn admin-btn-secondary shrink-0"
              onClick={() => setModel.mutate()}
              disabled={setModel.isPending || !modelId.trim()}
            >
              {setModel.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Export dataset with{' '}
            <code className="rounded bg-surface-secondary px-1.5 py-0.5 text-[0.85em]">
              python scripts/export_finetune_dataset.py
            </code>{' '}
            then train with{' '}
            <code className="rounded bg-surface-secondary px-1.5 py-0.5 text-[0.85em]">
              python scripts/finetune_interelia.py
            </code>
            .
          </p>
          {data?.last_train_status && (
            <p className="mt-auto pt-6 text-sm text-ink-muted">
              Last train status: <span className="font-medium text-ink">{data.last_train_status}</span>
            </p>
          )}
        </section>

        <section className="admin-panel flex min-h-[28rem] flex-col xl:min-h-0">
          <h2 className="font-display text-lg font-semibold">Test chat (RAG + model)</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Ask a pharmacy question to verify retrieval and model response.
          </p>
          <textarea
            className="admin-textarea mt-4 min-h-[7rem] flex-none resize-y"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="button"
            className="admin-btn admin-btn-primary mt-3 self-start"
            onClick={() => chat.mutate()}
            disabled={chat.isPending || !message.trim()}
          >
            {chat.isPending ? 'Asking…' : 'Ask'}
          </button>
          <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl bg-surface-secondary p-4">
            {reply ? (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{reply}</pre>
            ) : (
              <p className="text-sm text-ink-muted">Reply will appear here after you ask.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
