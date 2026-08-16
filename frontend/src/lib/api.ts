// Prefer Vite proxy (relative /api); override with VITE_API_URL if needed.
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

async function tryRefreshAccess(): Promise<string | null> {
  const refresh =
    typeof localStorage !== 'undefined' ? localStorage.getItem('interelia_refresh_token') : null
  if (!refresh) return null
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { access_token: string; refresh_token?: string }
    localStorage.setItem('interelia_access_token', data.access_token)
    if (data.refresh_token) localStorage.setItem('interelia_refresh_token', data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options
  const isForm = typeof FormData !== 'undefined' && rest.body instanceof FormData
  const isAuth = path.includes('/auth/login') || path.includes('/auth/refresh') || path.includes('/auth/register')

  const run = (access: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...headers,
      },
    })

  let access =
    token !== undefined
      ? token
      : typeof localStorage !== 'undefined'
        ? localStorage.getItem('interelia_access_token')
        : null

  let res = await run(access)

  if (res.status === 401 && !isAuth) {
    const refreshed = await tryRefreshAccess()
    if (refreshed) {
      access = refreshed
      res = await run(access)
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('interelia_access_token')
      localStorage.removeItem('interelia_refresh_token')
      // Keep Zustand auth store in sync so checkout/account stop using a dead token.
      window.dispatchEvent(new CustomEvent('interelia:session-expired'))
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(errorMessage(err.detail, res.status === 401 ? 'Session expired — please sign in' : 'Request failed'))
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export { API_URL }

export interface ApiProduct {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  mrp: number
  stock_qty: number
  requires_prescription: boolean
  pack_size: string | null
  ingredients: string | null
  usage_text: string | null
  warnings: string | null
  storage_text: string | null
  benefits: string[]
  image_url: string | null
  rating: number
  review_count: number
  category: string | null
  brand: string | null
  brand_slug: string | null
  in_stock: boolean
}

export interface ApiBrand {
  id: number
  name: string
  slug: string
  tagline: string | null
  description: string | null
  logo_url: string | null
  cover_image_url: string | null
  is_featured: boolean
  sort_order: number
  is_partner: boolean
  is_active: boolean
  website_url: string | null
  product_count: number
}

export interface ApiBrandDetail extends ApiBrand {
  products: ApiProduct[]
  total: number
  page: number
  page_size: number
}

export function mapApiProduct(p: ApiProduct) {
  // Storefront sells at MRP; PTR (API `price`) stays admin-only and is never shown to customers.
  const mrp = Number(p.mrp) > 0 ? Number(p.mrp) : Number(p.price)
  const rawImage = (p.image_url || '').trim()
  const looksMissingSeed =
    !rawImage ||
    rawImage.startsWith('/images/') ||
    rawImage.includes('/images/products/')
  let image = looksMissingSeed
    ? `https://placehold.co/600x600/E52B40/fff?text=${encodeURIComponent(p.name.slice(0, 12))}`
    : rawImage
  if (
    image.startsWith('/') &&
    !image.startsWith('//') &&
    (image.startsWith('/api/') || image.startsWith('/media/') || image.startsWith('/uploads/'))
  ) {
    image = `${API_URL}${image}`
  }
  return {
    id: String(p.id),
    slug: p.slug,
    name: p.name,
    brand: p.brand || 'Interelia',
    brandSlug: p.brand_slug || undefined,
    category: (p.category || 'wellness') as import('@/types').ProductCategory,
    price: mrp,
    mrp,
    discountPercent: 0,
    rating: Number(p.rating),
    reviewCount: p.review_count,
    image,
    inStock: p.in_stock,
    requiresPrescription: p.requires_prescription,
    packSize: p.pack_size || '',
    description: p.description || '',
    benefits: p.benefits || [],
    ingredients: p.ingredients || undefined,
    usage: p.usage_text || undefined,
    warnings: p.warnings || undefined,
    storage: p.storage_text || undefined,
  }
}

export interface ApiExpert {
  id: number
  name: string
  slug: string
  role: string
  specialty: string
  quote: string | null
  bio: string | null
  image_url: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  clinic_name: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  pincode: string | null
  maps_url: string | null
  availability_text: string | null
  accepting_calls: boolean
  accepting_visits: boolean
  is_featured: boolean
  is_active: boolean
  sort_order: number
}

export function mapApiExpert(e: ApiExpert): import('@/types').Expert {
  return {
    id: String(e.id),
    name: e.name,
    slug: e.slug,
    role: e.role,
    specialty: e.specialty,
    image:
      e.image_url ||
      `https://placehold.co/400x400/E52B40/fff?text=${encodeURIComponent(e.name.slice(0, 12))}`,
    quote: e.quote || '',
    bio: e.bio || undefined,
    phone: e.phone || undefined,
    whatsapp: e.whatsapp || e.phone || undefined,
    email: e.email || undefined,
    clinicName: e.clinic_name || undefined,
    addressLine1: e.address_line1 || undefined,
    addressLine2: e.address_line2 || undefined,
    city: e.city || undefined,
    state: e.state || undefined,
    pincode: e.pincode || undefined,
    mapsUrl: e.maps_url || undefined,
    availabilityText: e.availability_text || undefined,
    acceptingCalls: e.accepting_calls,
    acceptingVisits: e.accepting_visits,
  }
}

export function phoneDigits(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits || null
}

/** E.164-ish digits for India: 10-digit local → 91XXXXXXXXXX */
export function indiaPhoneDigits(phone?: string | null): string | null {
  let d = phoneDigits(phone)
  if (!d) return null
  if (!d.startsWith('91') && d.length === 10) d = `91${d}`
  return d
}

export function telHref(phone?: string | null): string | null {
  const d = indiaPhoneDigits(phone)
  return d ? `tel:+${d}` : null
}

export function waHref(phone?: string | null): string | null {
  const d = indiaPhoneDigits(phone)
  return d ? `https://wa.me/${d}` : null
}

export function expertAddressLines(e: {
  clinicName?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  pincode?: string
}): string[] {
  const lines: string[] = []
  if (e.clinicName) lines.push(e.clinicName)
  if (e.addressLine1) lines.push(e.addressLine1)
  if (e.addressLine2) lines.push(e.addressLine2)
  const cityLine = [e.city, e.state, e.pincode].filter(Boolean).join(', ')
  if (cityLine) lines.push(cityLine)
  return lines
}

export function buildMapsUrl(e: {
  mapsUrl?: string
  clinicName?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  pincode?: string
}): string | null {
  if (e.mapsUrl) return e.mapsUrl
  const q = expertAddressLines(e).join(', ')
  if (!q) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

