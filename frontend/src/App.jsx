import React, { useState, useEffect } from 'react'
import { ThemeProvider, useTheme } from './ThemeContext'
import Login from './components/Login'
import Upload from './components/Upload'
import Dashboard from './components/Dashboard'
import { getToken, getUser, clearAuth, isAuthenticated } from './utils/auth'
import api from './utils/api'

function AppInner() {
  const { isDark } = useTheme()

  // auth state
  const [authed, setAuthed]               = useState(isAuthenticated)
  const [currentUser, setCurrentUser]     = useState(getUser)

  // dashboard state
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading]             = useState(false)
  const [checkingCache, setCheckingCache] = useState(false)
  const [error, setError]                 = useState(null)

  // ── Listen for token events (axios 401 interceptor fires these) ──────────
  useEffect(() => {
    const onLogout = () => { setAuthed(false); setCurrentUser(null); setDashboardData(null) }
    const onLogin  = () => { setAuthed(true);  setCurrentUser(getUser()) }
    window.addEventListener('auth:logout', onLogout)
    window.addEventListener('auth:login',  onLogin)
    return () => {
      window.removeEventListener('auth:logout', onLogout)
      window.removeEventListener('auth:login',  onLogin)
    }
  }, [])

  // ── After login: try to load cached dashboard ─────────────────────────────
  useEffect(() => {
    if (!authed) return
    setCheckingCache(true)
    api.get('/api/dashboard')
      .then(res => setDashboardData(res.data))
      .catch(() => {/* 404 = no saved data, that's fine */})
      .finally(() => setCheckingCache(false))
  }, [authed])

  const handleAuth = (user) => {
    setAuthed(true)
    setCurrentUser(user)
  }

  const handleData = (data) => {
    setDashboardData(data)
    setLoading(false)
    setError(null)
  }

  const handleReset = () => {
    setDashboardData(null)
    setError(null)
    setLoading(false)
  }

  const handleLogout = () => {
    clearAuth()
    setAuthed(false)
    setCurrentUser(null)
    setDashboardData(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (!authed) {
    return <Login onAuth={handleAuth} />
  }

  if (checkingCache || loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          {checkingCache ? 'Loading your dashboard…' : 'Processing data…'}
        </p>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <Upload
        onData={handleData}
        onLoading={setLoading}
        onError={setError}
        error={error}
        user={currentUser}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <Dashboard
      data={dashboardData}
      onReset={handleReset}
      user={currentUser}
      onLogout={handleLogout}
    />
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}
