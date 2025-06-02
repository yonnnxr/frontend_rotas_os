import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Layouts
const AuthLayout = lazy(() => import('./layouts/AuthLayout'))
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'))

// Pages
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NotFound = lazy(() => import('./pages/NotFound'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { team, isLoading } = useAuth()

  if (isLoading) {
    return <div>Carregando...</div>
  }

  if (!team) {
    return <Navigate to="/login" />
  }

  return <>{children}</>
}

export function AppRoutes() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <Routes>
        {/* Rotas públicas */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Rotas protegidas */}
        <Route element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }>
          <Route path="/" element={<Dashboard />} />
        </Route>

        {/* Rota 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
} 