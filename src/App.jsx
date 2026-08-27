import { Routes, Route } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingSpinner from './components/LoadingSpinner'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import UserDashboard from './pages/UserDashboard'
import NewTicket from './pages/NewTicket'
import TicketDetail from './pages/TicketDetail'
import SupportDashboard from './pages/SupportDashboard'
import SupervisorDashboard from './pages/SupervisorDashboard'

function HomeByRole() {
  const { profile, loading } = useAuth()
  if (loading || !profile) return <LoadingSpinner />

  if (profile.role === 'support') return <SupportDashboard />
  if (profile.role === 'supervisor') return <SupervisorDashboard />
  return <UserDashboard />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

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
          <ProtectedRoute allowedRoles={['user']}>
            <Layout><NewTicket /></Layout>
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

      <Route path="*" element={<Login />} />
    </Routes>
  )
}
