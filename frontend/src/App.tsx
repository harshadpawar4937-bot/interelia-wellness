import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/MainLayout'
import { ErrorBoundary, NotFoundPage } from '@/components/ErrorBoundary'
import { HomePage } from '@/pages/HomePage'
import { ShopPage } from '@/pages/shop/ShopPage'
import { ProductDetailPage } from '@/pages/shop/ProductDetailPage'
import { CartPage } from '@/pages/shop/CartPage'
import { CheckoutPage } from '@/pages/shop/CheckoutPage'
import { PrescriptionPage } from '@/pages/PrescriptionPage'
import { AIAssistantPage } from '@/pages/AIAssistantPage'
import { HealthHubPage, BlogArticlePage } from '@/pages/health/HealthPages'
import {
  AccountLayout,
  AccountDashboard,
  AccountOrders,
  AccountWishlist,
  AccountPrescriptions,
  AccountAddresses,
  AccountRewards,
  AccountNotifications,
  AccountSupport,
  LoginPage,
} from '@/pages/account/AccountPages'
import {
  AccountMedicineRequestDetail,
  AccountMedicineRequests,
} from '@/pages/account/MedicineRequestPages'
import { ExpertsPage, SupportPage, LegalPage } from '@/pages/ExpertsSupportPages'
import { BrandsDirectoryPage } from '@/pages/brands/BrandsDirectoryPage'
import { BrandHubPage } from '@/pages/brands/BrandHubPage'
import { RequestMedicinePage } from '@/pages/RequestMedicinePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="shop" element={<ShopPage />} />
              <Route path="shop/:category" element={<ShopPage />} />
              <Route path="brands" element={<BrandsDirectoryPage />} />
              <Route path="brands/:slug" element={<BrandHubPage />} />
              <Route path="product/:slug" element={<ProductDetailPage />} />
              <Route path="cart" element={<CartPage />} />
              <Route path="checkout" element={<CheckoutPage />} />
              <Route path="prescription" element={<PrescriptionPage />} />
              <Route path="request-medicine" element={<RequestMedicinePage />} />
              <Route path="ai-assistant" element={<AIAssistantPage />} />
              <Route path="health" element={<HealthHubPage />} />
              <Route path="health/:slug" element={<BlogArticlePage />} />
              <Route path="experts" element={<ExpertsPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="account" element={<AccountLayout />}>
                <Route index element={<AccountDashboard />} />
                <Route path="orders" element={<AccountOrders />} />
                <Route path="medicine-requests" element={<AccountMedicineRequests />} />
                <Route path="medicine-requests/:id" element={<AccountMedicineRequestDetail />} />
                <Route path="wishlist" element={<AccountWishlist />} />
                <Route path="prescriptions" element={<AccountPrescriptions />} />
                <Route path="addresses" element={<AccountAddresses />} />
                <Route path="rewards" element={<AccountRewards />} />
                <Route path="notifications" element={<AccountNotifications />} />
                <Route path="support" element={<AccountSupport />} />
              </Route>
              <Route
                path="legal/privacy"
                element={
                  <LegalPage
                    title="Privacy Policy"
                    body={`Interelia Wellness respects your privacy. Contact: privacy@interelia.com`}
                  />
                }
              />
              <Route
                path="legal/terms"
                element={
                  <LegalPage
                    title="Terms of Use"
                    body={`By using Interelia Wellness you agree to authentic product purchase terms and applicable Indian pharmacy regulations. AI guidance is educational only.`}
                  />
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
