import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, FileText, CheckCircle2, Clock, Shield } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import { API_URL } from '@/lib/api'

const steps = [
  { title: 'Upload', desc: 'Photo or PDF of your prescription' },
  { title: 'Queue', desc: 'Stored securely for review' },
  { title: 'Pharmacist Review', desc: 'Licensed verification' },
  { title: 'Order Ready', desc: 'Approve & checkout securely' },
]

interface ApiRx {
  id: number
  status: string
  file_url: string
  file_name: string | null
  extracted_medicines: string | null
  notes: string | null
  created_at: string | null
}

export function PrescriptionPage() {
  const { isAuthenticated, accessToken } = useAuthStore()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['my-rx'],
    enabled: !!accessToken,
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/prescriptions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('Failed to load prescriptions')
      return (await res.json()) as ApiRx[]
    },
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_URL}/api/v1/prescriptions/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(typeof err.detail === 'string' ? err.detail : 'Upload failed')
      }
      return res.json()
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-rx'] })
    },
  })

  const handleFile = (file: File | null) => {
    setError('')
    if (!file) return
    if (!isAuthenticated || !accessToken) {
      setError('Please sign in to upload a prescription.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB')
      return
    }
    upload.mutate(file, {
      onError: (err) => setError(err instanceof Error ? err.message : 'Upload failed'),
    })
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'neutral' | 'warning' | 'success' | 'brand' }> = {
      uploaded: { label: 'Uploaded', variant: 'neutral' },
      pending_review: { label: 'Pharmacist Review', variant: 'warning' },
      approved: { label: 'Approved', variant: 'success' },
      rejected: { label: 'Rejected', variant: 'brand' },
    }
    const s = map[status] || { label: status, variant: 'neutral' as const }
    return <Badge variant={s.variant}>{s.label}</Badge>
  }

  return (
    <div className="container-brand py-8 lg:py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Upload prescription</h1>
        <p className="mt-3 text-ink-muted">
          Secure upload with licensed pharmacist verification — Interelia&apos;s trusted Rx workflow.
        </p>
        {!isAuthenticated && (
          <p className="mt-3 text-sm text-brand">
            <Link to="/login?next=/prescription" className="underline">
              Sign in
            </Link>{' '}
            to upload and track prescriptions.
          </p>
        )}
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-border p-4 text-center">
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
              {i + 1}
            </span>
            <p className="mt-2 font-display text-sm font-semibold">{s.title}</p>
            <p className="mt-1 text-xs text-ink-muted">{s.desc}</p>
          </div>
        ))}
      </div>

      <motion.div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files[0] ?? null)
        }}
        className={`mx-auto mt-10 max-w-2xl rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging ? 'border-brand bg-brand-soft' : 'border-border bg-surface-secondary'
        }`}
      >
        <Upload size={40} className="mx-auto text-brand" />
        <p className="mt-4 font-display text-lg font-semibold">Drag & drop your prescription</p>
        <p className="mt-1 text-sm text-ink-muted">JPG, PNG or PDF · Max 10MB · Stored securely on server</p>
        <label className="mt-6 inline-block">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,.pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <span className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
            Choose file
          </span>
        </label>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted">
          <Shield size={14} /> Privacy-first storage · Audit logged in admin
        </div>
        {error && <p className="mt-3 text-sm text-brand">{error}</p>}
        {upload.isPending && (
          <p className="mt-4 text-sm text-brand">
            <Clock className="mr-1 inline" size={14} /> Uploading…
          </p>
        )}
      </motion.div>

      <section className="mx-auto mt-14 max-w-3xl">
        <h2 className="font-display text-xl font-bold">Prescription history</h2>
        {isLoading && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}
        <ul className="mt-4 space-y-3">
          {history.map((rx) => (
            <li key={rx.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <FileText className="mt-0.5 text-brand" size={20} />
                  <div>
                    <p className="font-medium">{rx.file_name || `Rx #${rx.id}`}</p>
                    <p className="text-xs text-ink-muted">
                      {rx.created_at ? new Date(rx.created_at).toLocaleString('en-IN') : ''}
                    </p>
                    {rx.extracted_medicines && (
                      <p className="mt-2 text-sm text-ink-muted">Detected: {rx.extracted_medicines}</p>
                    )}
                    {rx.notes && <p className="mt-1 text-sm text-ink-muted">{rx.notes}</p>}
                  </div>
                </div>
                {statusBadge(rx.status)}
              </div>
              {rx.status === 'approved' && (
                <Button size="sm" className="mt-3" onClick={() => (window.location.href = '/checkout')}>
                  <CheckCircle2 size={14} /> Proceed to checkout
                </Button>
              )}
            </li>
          ))}
          {!isLoading && history.length === 0 && (
            <li className="text-sm text-ink-muted">No prescriptions uploaded yet.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
