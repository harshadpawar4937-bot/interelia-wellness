import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'

export function LoginPage() {
  const { token, login, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Stale tokens from a previous session should not block the login form
  if (token) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form
        className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          setLoading(true)
          try {
            logout()
            await login(email, password)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed')
          } finally {
            setLoading(false)
          }
        }}
      >
        <h1 className="font-display text-2xl font-bold">
          Interelia <span className="text-brand">Admin</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Staff login — separate from storefront</p>
        <label className="mt-6 block text-sm font-medium">Email</label>
        <input
          className="mt-1 w-full rounded-md border border-border px-3 py-2.5"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-border px-3 py-2.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-3 text-sm text-brand">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-md bg-brand py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
