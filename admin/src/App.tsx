import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminShell } from '@/components/AdminShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { BrandsPage } from '@/pages/BrandsPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { PrescriptionsPage } from '@/pages/PrescriptionsPage'
import { MedicineRequestsPage } from '@/pages/MedicineRequestsPage'
import { UsersPage } from '@/pages/UsersPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { ContentPage } from '@/pages/ContentPage'
import { AIPage } from '@/pages/AIPage'
import { ExpertsAdminPage } from '@/pages/ExpertsAdminPage'

const qc = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AdminShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="prescriptions" element={<PrescriptionsPage />} />
            <Route path="medicine-requests" element={<MedicineRequestsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="experts" element={<ExpertsAdminPage />} />
            <Route path="ai" element={<AIPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
