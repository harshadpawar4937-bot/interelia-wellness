import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Banknote, CheckCircle2, MapPin, Timer } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ExpressDeliveryBadge } from '@/components/ExpressDeliveryBadge'

interface CheckoutForm {
  name: string
  phone: string
  email: string
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
}

interface ApiRx {
  id: number
  status: string
  file_name: string | null
}

interface DeliveryCheck {
  eligible: boolean
  distance_km: number | null
  eta_minutes: number | null
  message: string
  radius_km: number
}

type SavedAddress = {
  id: string
  label: string
  line1: string
  city: string
  pincode: string
  phone: string
  isDefault?: boolean
}

export function CheckoutPage() {
  const { items, subtotal, clearCart } = useCartStore()
  const { isAuthenticated, accessToken, user } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const medicineRequestId = (() => {
    const from = searchParams.get('from') || ''
    const m = from.match(/^medicine-request=(\d+)$/)
    return m ? Number(m[1]) : null
  })()
  const [placed, setPlaced] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [approvedRx, setApprovedRx] = useState<ApiRx[]>([])
  const [prescriptionId, setPrescriptionId] = useState<number | ''>('')
  const [deliveryCheck, setDeliveryCheck] = useState<DeliveryCheck | null>(null)
  const [checkingDelivery, setCheckingDelivery] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: {
      city: 'Ahmedabad',
      state: 'Gujarat',
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
  })

  const total = subtotal()
  const delivery = total >= 499 ? 0 : 49
  const grand = total + delivery
  const needsRx = items.some((i) => i.product.requiresPrescription)
  const line1 = watch('line1')
  const pincode = watch('pincode')
  const city = watch('city')

  const savedAddresses: SavedAddress[] = (() => {
    if (!user?.id) return []
    try {
      const raw = localStorage.getItem(`interelia-addresses-${user.id}`)
      return raw ? (JSON.parse(raw) as SavedAddress[]) : []
    } catch {
      return []
    }
  })()

  useEffect(() => {
    if (!accessToken || !needsRx) return
    void api<ApiRx[]>('/api/v1/prescriptions', { token: accessToken })
      .then((rows) => {
        const ok = rows.filter((r) => r.status === 'approved')
        setApprovedRx(ok)
        if (ok[0]) setPrescriptionId(ok[0].id)
      })
      .catch(() => setApprovedRx([]))
  }, [accessToken, needsRx])

  useEffect(() => {
    const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0]
    if (!defaultAddr) return
    setValue('line1', defaultAddr.line1)
    setValue('city', defaultAddr.city || 'Ahmedabad')
    setValue('pincode', defaultAddr.pincode)
    if (defaultAddr.phone) setValue('phone', defaultAddr.phone)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefills once when user/addresses available
  }, [user?.id])

  const runDeliveryCheck = async () => {
    const values = getValues()
    if (!values.line1?.trim() || !values.pincode?.trim()) {
      setDeliveryCheck(null)
      return
    }
    setCheckingDelivery(true)
    try {
      const res = await api<DeliveryCheck>('/api/v1/delivery/check', {
        method: 'POST',
        body: JSON.stringify({
          shipping_address: {
            line1: values.line1,
            line2: values.line2,
            city: values.city || 'Ahmedabad',
            state: values.state || 'Gujarat',
            pincode: values.pincode,
          },
        }),
      })
      setDeliveryCheck(res)
    } catch (err) {
      setDeliveryCheck({
        eligible: false,
        distance_km: null,
        eta_minutes: null,
        message: err instanceof Error ? err.message : 'Could not check delivery',
        radius_km: 6,
      })
    } finally {
      setCheckingDelivery(false)
    }
  }

  useEffect(() => {
    if (!line1 || !pincode || String(pincode).replace(/\D/g, '').length < 6) {
      setDeliveryCheck(null)
      return
    }
    const t = window.setTimeout(() => {
      void runDeliveryCheck()
    }, 450)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line1, pincode, city])

  useEffect(() => {
    if (items.length === 0 && !placed) {
      navigate('/cart', { replace: true })
    }
  }, [items.length, placed, navigate])

  if (items.length === 0 && !placed) {
    return (
      <div className="container-brand py-16 text-center text-sm text-ink-muted">
        Your cart is empty — redirecting…
      </div>
    )
  }

  const onSubmit = async (data: CheckoutForm) => {
    setError('')
    if (!isAuthenticated || !accessToken) {
      navigate('/login?next=/checkout')
      return
    }
    if (needsRx && !prescriptionId) {
      setError('Select an approved prescription for Rx medicines in your cart.')
      return
    }
    if (deliveryCheck && !deliveryCheck.eligible) {
      setError(deliveryCheck.message)
      return
    }
    setSubmitting(true)
    try {
      if (!deliveryCheck) await runDeliveryCheck()
      const order = await api<{ id: number; order_number: string; delivery_eta_minutes?: number }>(
        '/api/v1/orders',
        {
          method: 'POST',
          token: accessToken,
          body: JSON.stringify({
            items: items.map((i) => ({
              product_id: Number(i.product.id),
              quantity: i.quantity,
            })),
            shipping_address: {
              name: data.name,
              phone: data.phone,
              email: data.email,
              line1: data.line1,
              line2: data.line2,
              city: data.city,
              state: data.state,
              pincode: data.pincode,
            },
            payment_method: 'cod',
            prescription_id: needsRx ? Number(prescriptionId) : null,
          }),
        },
      )
      if (medicineRequestId) {
        try {
          await api(`/api/v1/medicine-requests/${medicineRequestId}/attach-order`, {
            method: 'POST',
            token: accessToken,
            body: JSON.stringify({ order_id: order.id }),
          })
        } catch {
          // Order succeeded; request link is best-effort
        }
      }
      setOrderId(order.order_number)
      setEtaMinutes(order.delivery_eta_minutes ?? 30)
      setPlaced(true)
      clearCart()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place order')
    } finally {
      setSubmitting(false)
    }
  }

  if (placed) {
    return (
      <div className="container-brand py-20 text-center">
        <CheckCircle2 size={56} className="mx-auto text-success" />
        <h1 className="mt-4 font-display text-3xl font-bold">Order placed successfully</h1>
        <p className="mt-2 text-ink-muted">
          Order <span className="font-semibold text-ink">{orderId}</span> confirmed. Pay on delivery
          (COD).
        </p>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-success">
          <Timer size={16} /> Express delivery within {etaMinutes ?? 30} minutes
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={() => navigate('/account/orders')}>Track order</Button>
          <Button variant="outline" onClick={() => navigate('/shop')}>
            Continue shopping
          </Button>
        </div>
      </div>
    )
  }

  const canSubmit =
    (!needsRx || Boolean(prescriptionId)) &&
    deliveryCheck?.eligible === true &&
    !checkingDelivery

  return (
    <div className="container-brand py-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Checkout</h1>
        <ExpressDeliveryBadge />
      </div>
      {!isAuthenticated && (
        <p className="mt-2 text-sm text-brand">
          Please{' '}
          <Link to="/login?next=/checkout" className="underline">
            sign in
          </Link>{' '}
          to place an order.
        </p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section>
            <h2 className="font-display text-lg font-bold">Delivery address</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Express service: within 6 km of Interelia Wellness, Gota · about 30 minutes.
            </p>
            {savedAddresses.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {savedAddresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs hover:border-brand"
                    onClick={() => {
                      setValue('line1', a.line1)
                      setValue('city', a.city || 'Ahmedabad')
                      setValue('pincode', a.pincode)
                      if (a.phone) setValue('phone', a.phone)
                    }}
                  >
                    Use {a.label}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Full name" id="name" {...register('name', { required: 'Required' })} error={errors.name?.message} />
              <Input label="Phone" id="phone" {...register('phone', { required: 'Required' })} error={errors.phone?.message} />
              <Input label="Email" id="email" type="email" className="sm:col-span-2" {...register('email', { required: 'Required' })} error={errors.email?.message} />
              <Input label="Address line 1" id="line1" className="sm:col-span-2" {...register('line1', { required: 'Required' })} error={errors.line1?.message} />
              <Input label="Address line 2" id="line2" className="sm:col-span-2" {...register('line2')} />
              <Input label="City" id="city" {...register('city', { required: 'Required' })} error={errors.city?.message} />
              <Input label="State" id="state" {...register('state', { required: 'Required' })} error={errors.state?.message} />
              <Input
                label="PIN code"
                id="pincode"
                {...register('pincode', {
                  required: 'Required',
                  pattern: { value: /^\d{6}$/, message: '6-digit PIN' },
                })}
                error={errors.pincode?.message}
              />
            </div>
            <div className="mt-4 rounded-lg border border-border bg-surface-secondary p-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-brand" />
                <div>
                  {checkingDelivery && <p className="text-ink-muted">Checking express delivery…</p>}
                  {!checkingDelivery && deliveryCheck && (
                    <p className={deliveryCheck.eligible ? 'text-success' : 'text-brand'}>
                      {deliveryCheck.message}
                    </p>
                  )}
                  {!checkingDelivery && !deliveryCheck && (
                    <p className="text-ink-muted">Enter address + PIN to check 6 km / 30 min eligibility.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {needsRx && (
            <section>
              <h2 className="font-display text-lg font-bold">Approved prescription</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Required for Rx medicines.{' '}
                <Link to="/prescription" className="text-brand underline">
                  Upload Rx
                </Link>
              </p>
              {approvedRx.length === 0 ? (
                <p className="mt-3 text-sm text-brand">
                  No approved prescriptions yet. A pharmacist must approve your upload first.
                </p>
              ) : (
                <select
                  className="mt-3 w-full max-w-md rounded-md border border-border px-3 py-2.5 text-sm"
                  value={prescriptionId}
                  onChange={(e) => setPrescriptionId(e.target.value ? Number(e.target.value) : '')}
                >
                  {approvedRx.map((rx) => (
                    <option key={rx.id} value={rx.id}>
                      #{rx.id} · {rx.file_name || 'Prescription'}
                    </option>
                  ))}
                </select>
              )}
            </section>
          )}

          <section>
            <h2 className="font-display text-lg font-bold">Payment method</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Online payments (Razorpay) coming soon. Cash on Delivery is available now.
            </p>
            <div className="mt-4">
              <div className="flex w-full max-w-xs items-center gap-3 rounded-xl border border-brand bg-brand-soft p-4 text-sm text-brand">
                <Banknote size={22} />
                Cash on Delivery (COD)
              </div>
            </div>
          </section>
          {error && <p className="text-sm text-brand">{error}</p>}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface-secondary p-6">
          <h2 className="font-display text-lg font-bold">Your order</h2>
          <ul className="mt-4 max-h-48 space-y-3 overflow-y-auto text-sm">
            {items.map(({ product, quantity }) => (
              <li key={product.id} className="flex justify-between gap-2">
                <span className="text-ink-muted">
                  {product.name} × {quantity}
                  {product.requiresPrescription ? ' (Rx)' : ''}
                </span>
                <span className="shrink-0 font-medium">
                  {formatPrice((product.mrp > 0 ? product.mrp : product.price) * quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Delivery</span>
              <span>{delivery === 0 ? 'FREE' : formatPrice(delivery)}</span>
            </div>
            {deliveryCheck?.eligible && (
              <div className="flex justify-between text-success">
                <span>ETA</span>
                <span>{deliveryCheck.eta_minutes ?? 30} min</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="text-brand">{formatPrice(grand)}</span>
            </div>
          </div>
          <Button type="submit" fullWidth size="lg" className="mt-6" disabled={submitting || !canSubmit}>
            {submitting
              ? 'Placing order…'
              : deliveryCheck && !deliveryCheck.eligible
                ? 'Outside 6 km zone'
                : `Place COD order · ${formatPrice(grand)}`}
          </Button>
        </aside>
      </form>
    </div>
  )
}
