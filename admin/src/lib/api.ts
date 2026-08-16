const API_URL = import.meta.env.VITE_API_URL ?? ''

function errorMessage(detail: unknown, fallback = 'Request failed'): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: string }).msg) : String(d)))
      .filter(Boolean)
      .join(', ')
  }
  return fallback
}

type AuthHandlers = {
  getAccessToken: () => string | null
  getRefreshToken: () => string | null
  setTokens: (access: string, refresh?: string | null) => void
  onUnauthorized: () => void
}

let authHandlers: AuthHandlers | null = null
let refreshInFlight: Promise<string | null> | null = null

export function setAuthHandlers(handlers: AuthHandlers) {
  authHandlers = handlers
}

async function tryRefresh(): Promise<string | null> {
  if (!authHandlers) return null
  const refresh = authHandlers.getRefreshToken()
  if (!refresh) return null
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        })
        if (!res.ok) return null
        const data = (await res.json()) as {
          access_token: string
          refresh_token?: string
        }
        authHandlers?.setTokens(data.access_token, data.refresh_token ?? refresh)
        return data.access_token
      } catch {
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token: tokenOpt, headers, ...rest } = options
  const isForm = typeof FormData !== 'undefined' && rest.body instanceof FormData
  const isAuthEndpoint = path.includes('/auth/login') || path.includes('/auth/refresh')

  const run = async (access: string | null | undefined) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...headers,
      },
    })
    return res
  }

  let access = tokenOpt !== undefined ? tokenOpt : authHandlers?.getAccessToken() ?? null
  let res = await run(access)

  if (res.status === 401 && !isAuthEndpoint) {
    const newAccess = await tryRefresh()
    if (newAccess) {
      access = newAccess
      res = await run(access)
    } else {
      authHandlers?.onUnauthorized()
      const err = await res.json().catch(() => ({ detail: 'Invalid token' }))
      throw new Error(errorMessage(err.detail, 'Session expired — please sign in again'))
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const msg = errorMessage(err.detail, 'Request failed')
    if (res.status === 401) {
      authHandlers?.onUnauthorized()
      throw new Error(msg === 'Invalid token' ? 'Session expired — please sign in again' : msg)
    }
    if (res.status === 403) {
      throw new Error(msg.startsWith('Missing permission') ? msg : `Forbidden: ${msg}`)
    }
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function downloadAuthed(path: string, filename: string, token?: string | null) {
  const access = token !== undefined ? token : authHandlers?.getAccessToken() ?? null
  let res = await fetch(`${API_URL}${path}`, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  })
  if (res.status === 401) {
    const newAccess = await tryRefresh()
    if (newAccess) {
      res = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${newAccess}` },
      })
    } else {
      authHandlers?.onUnauthorized()
      throw new Error('Session expired — please sign in again')
    }
  }
  if (!res.ok) throw new Error('Download failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function uploadAuthed<T>(path: string, formData: FormData, token?: string | null): Promise<T> {
  const run = async (access: string | null) =>
    fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: formData,
    })

  let access = token !== undefined ? token : authHandlers?.getAccessToken() ?? null
  let res = await run(access)
  if (res.status === 401) {
    const newAccess = await tryRefresh()
    if (newAccess) {
      access = newAccess
      res = await run(access)
    } else {
      authHandlers?.onUnauthorized()
      throw new Error('Session expired — please sign in again')
    }
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(errorMessage((body as { detail?: unknown }).detail, 'Upload failed'))
  }
  return body as T
}

export { API_URL }

/** Resolve relative media paths (/api/v1/media/...) against the API origin. */
export function mediaSrc(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  return `${API_URL}${url}`
}
