import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import LoginPage from './pages/LoginPage'
import AppShell from './pages/AppShell'

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AuthInit() {
  const { init } = useAuthStore()
  useEffect(() => { init() }, [init])
  return null
}

export default function App() {
  return (
    <>
      <AuthInit />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <PrivateRoute><AppShell /></PrivateRoute>
        } />
      </Routes>
    </>
  )
}
