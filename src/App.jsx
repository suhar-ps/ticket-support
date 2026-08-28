import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import UserDashboard from './pages/UserDashboard'
import NewTicket from './pages/NewTicket'
import TicketDetail from './pages/TicketDetail'
import SupportDashboard from './pages/SupportDashboard'
import SupervisorDashboard from './pages/SupervisorDashboard'
import UserAdministration from './pages/UserAdministration'

function HomeByRole() {
  const { profile, loading } = useAuth()
  if (loading || !profile) return <LoadingSpinner />

  if (profile.role === 'support') return <SupportDashboard />
  if (profile.role === 'supervisor') return <SupervisorDashboard />
  if (profile.role === 'superadmin') return <SupervisorDashboard />
  return <UserDashboard />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout><HomeByRole /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets/new"
        element={
          <ProtectedRoute allowedRoles={['user', 'supervisor', 'superadmin']}>
            <Layout><NewTicket /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/queue"
        element={
          <ProtectedRoute allowedRoles={['support', 'supervisor', 'superadmin']}>
            <Layout><SupportDashboard /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/my-tickets"
        element={
          <ProtectedRoute allowedRoles={['user', 'supervisor', 'superadmin']}>
            <Layout><UserDashboard /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tickets/:id"
        element={
          <ProtectedRoute>
            <Layout><TicketDetail /></Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['superadmin']}>
            <Layout><UserAdministration /></Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Login />} />
    </Routes>
  )
}
