import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/store/auth'

interface UserRow {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
}

const ROLES = ['customer', 'support_agent', 'content_manager', 'pharmacist', 'super_admin']

export function UsersPage() {
  const token = useAuth((s) => s.token)
  const qc = useQueryClient()
  const { data = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<UserRow[]>('/api/v1/admin/users', { token }),
  })

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      api(`/api/v1/admin/users/${id}/role?role=${encodeURIComponent(role)}`, {
        method: 'PATCH',
        token,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Users & RBAC</h1>
      <p className="mt-1 text-sm text-ink-muted">Staff accounts for the admin panel — not CRM customers</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-secondary text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded border border-border px-2 py-1"
                    value={u.role}
                    onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
