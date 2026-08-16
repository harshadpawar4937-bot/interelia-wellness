import { create } from 'zustand'

interface QuickViewState {
  productId: number | null
  open: (productId: number) => void
  close: () => void
}

export const useQuickViewStore = create<QuickViewState>((set) => ({
  productId: null,
  open: (productId) => set({ productId }),
  close: () => set({ productId: null }),
}))
