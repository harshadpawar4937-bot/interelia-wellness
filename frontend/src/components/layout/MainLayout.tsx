import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { AIChatWidget } from '@/components/ai/AIChatWidget'
import { ProductQuickView } from '@/components/product/ProductQuickView'

/** Storefront shell with sticky header, footer, and floating AI assistant */
export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AIChatWidget />
      <ProductQuickView />
    </div>
  )
}
