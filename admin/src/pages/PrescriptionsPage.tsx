import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface Rx {
  id: number
  status: string
  file_name: string | null
  extracted_medicines: string | null
  notes: string | null
  user_id: number
}

export function PrescriptionsPage() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const { data = [] } = useQuery({
    queryKey: ['admin-rx'],
    queryFn: () => api<Rx[]>('/api/v1/admin/prescriptions', { token }),
  })

  const act = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'approve' | 'reject' }) =>
      api(`/api/v1/admin/prescriptions/${id}/${action}`, {
        method: 'POST',
        token,
        body: JSON.stringify({ notes: action === 'approve' ? 'Verified' : 'Rejected' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-rx'] }),
  })

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Prescription review queue</h1>
      <ul className="mt-6 space-y-3">
        {data.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">RX-{r.id}</p>
                <p className="text-sm text-ink-muted">
                  {r.file_name} · OCR: {r.extracted_medicines}
                </p>
                <p className="text-xs text-ink-muted">Status: {r.status}</p>
              </div>
              {r.status === 'pending_review' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-success px-3 py-1.5 text-xs text-white"
                    onClick={() => act.mutate({ id: r.id, action: 'approve' })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1.5 text-xs"
                    onClick={() => act.mutate({ id: r.id, action: 'reject' })}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
        {data.length === 0 && <p className="text-sm text-ink-muted">Queue empty.</p>}
      </ul>
    </div>
  )
}
