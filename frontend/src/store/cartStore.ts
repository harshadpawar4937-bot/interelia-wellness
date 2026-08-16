import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product } from '@/types'

interface CartState {
  items: CartItem[]
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  itemCount: () => number
  subtotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: i.quantity + quantity }
                  : i,
              ),
            }
          }
          return { items: [...state.items, { product, quantity }] }
        })
      },
      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== productId),
        })),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.product.id === productId ? { ...i, quantity } : i))
            .filter((i) => i.quantity > 0),
        })),
      clearCart: () => set({ items: [] }),
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () =>
        get().items.reduce((sum, i) => {
          const unit = i.product.mrp > 0 ? i.product.mrp : i.product.price
          return sum + unit * i.quantity
        }, 0),
    }),
    {
      name: 'interelia-cart',
      // Normalize legacy persisted carts that may still hold PTR in `price`.
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<CartState>
        const items = (p.items || []).map((item) => {
          const mrp = Number(item.product?.mrp) > 0 ? Number(item.product.mrp) : Number(item.product?.price) || 0
          return {
            ...item,
            product: { ...item.product, mrp, price: mrp },
          }
        })
        return { ...current, ...p, items }
      },
    },
  ),
)
