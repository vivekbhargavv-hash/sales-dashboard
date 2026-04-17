import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle2, Loader2, Sun, Moon } from 'lucide-react'
import api from '../utils/api'
import { setAuth } from '../utils/auth'
import { useTheme } from '../ThemeContext'

export default function Login({ onAuth }) {
  const [tab, setTab]           = useState('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Forgot-password state
  const [forgotMode, setForgotMode]       = useState(false)
  const [forgotEmail, setForgotEmail]     = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent]       = useState(false)
  const [forgotError, setForgotError]     = useState('')

  const { isDark, toggleTheme, tw } = useTheme()
  const isSignup = tab === 'signup'

  const inp = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
    isDark
      ? 'bg-slate-700/60 border-slate-600 text-white placeholder-slate-400 focus:border-green-500 focus:ring-1 focus:ring-green-500/30'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500/30'
  }`

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (isSignup && !name.trim())              { setError('Please enter your name.'); return }
    if (!email.trim() || !email.includes('@')) { setError('Please enter a valid email.'); return }
    if (password.length < 6)                   { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      const payload = isSignup
        ? { name: name.trim(), email: email.trim().toLowerCase(), password }
        : { email: email.trim().toLowerCase(), password }
      const { data } = await api.post(isSignup ? '/signup' : '/login', payload)
      setAuth(data.access_token, data.user)
      onAuth(data.user)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setForgotError('')
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid email address.')
      return
    }
    setForgotLoading(true)
    try {
      await api.post('/forgot-password', { email: forgotEmail.trim().toLowerCase() })
      setForgotSent(true)
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  const exitForgot = () => {
    setForgotMode(false)
    setForgotSent(false)
    setForgotEmail('')
    setForgotError('')
  }

  // ── Forgot-password panel ─────────────────────────────────────────────────
  const ForgotPanel = (
    <div className="space-y-4">
      {forgotSent ? (
        <div className="text-center space-y-4 py-2">
          <div className="flex justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <div>
            <p className={`font-semibold ${tw.textPrimary}`}>Check your inbox</p>
            <p className={`text-sm mt-1 ${tw.textSecondary}`}>
              If <span className="font-medium">{forgotEmail}</span> is registered,
              a reset link has been sent. Check spam if it doesn't arrive in a minute.
            </p>
          </div>
          <button onClick={exitForgot}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm
              bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400
              transition-all shadow-lg hover:scale-[1.01] active:scale-100">
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleForgot} className="space-y-4">
          <p className={`text-sm ${tw.textSecondary}`}>
            Enter your account email and we'll send you a link to reset your password.
          </p>
          <div className="relative">
            <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${tw.textSecondary}`} />
            <input type="email" placeholder="Email address" value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              className={`${inp} pl-10`} autoComplete="email" required />
          </div>

          {forgotError && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-500">{forgotError}</p>
            </div>
          )}

          <button type="submit" disabled={forgotLoading}
            className="w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all
              flex items-center justify-center gap-2
              bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400
              disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:scale-[1.01] active:scale-100">
            {forgotLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              : 'Send reset link'}
          </button>

          <p className={`text-center text-sm ${tw.textSecondary}`}>
            <button type="button" onClick={exitForgot}
              className="text-green-500 hover:text-green-400 font-semibold transition-colors">
              ← Back to sign in
            </button>
          </p>
        </form>
      )}
    </div>
  )

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${tw.root}`}>

      <button onClick={toggleTheme}
        className={`fixed top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${tw.uploadReset}`}>
        {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
        <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <picture>
              <source srcSet="/moeving-logo.png" type="image/png" />
              <img src="/moeving-logo.svg" alt="Moeving" className="h-12 w-auto object-contain"
                onError={e => { e.target.style.display = 'none' }} />
            </picture>
          </div>
          <h1 className={`text-2xl font-bold ${tw.textPrimary}`}>Sales Intelligence</h1>
          <p className={`mt-1 text-sm ${tw.textSecondary}`}>
            {forgotMode
              ? 'Reset your password'
              : isSignup ? 'Create your account to get started' : 'Sign in to access your dashboard'}
          </p>
        </div>

        <div className={`${tw.card} rounded-2xl p-8 shadow-2xl`}>

          {forgotMode ? ForgotPanel : (
            <>
              {/* Tab switcher */}
              <div className={`flex rounded-xl p-1 mb-6 ${isDark ? 'bg-slate-700/60' : 'bg-gray-100'}`}>
                {['login', 'signup'].map(t => (
                  <button key={t} onClick={() => { setTab(t); setError('') }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                      tab === t
                        ? isDark ? 'bg-slate-800 text-white shadow' : 'bg-white text-gray-900 shadow'
                        : tw.textSecondary
                    }`}>
                    {t === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                  <div className="relative">
                    <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${tw.textSecondary}`} />
                    <input type="text" placeholder="Full name" value={name}
                      onChange={e => setName(e.target.value)}
                      className={`${inp} pl-10`} autoComplete="name" required />
                  </div>
                )}

                <div className="relative">
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${tw.textSecondary}`} />
                  <input type="email" placeholder="Email address" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={`${inp} pl-10`} autoComplete="email" required />
                </div>

                <div className="relative">
                  <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${tw.textSecondary}`} />
                  <input type={showPwd ? 'text' : 'password'}
                    placeholder={isSignup ? 'Create password (min 6 chars)' : 'Password'}
                    value={password} onChange={e => setPassword(e.target.value)}
                    className={`${inp} pl-10 pr-10`}
                    autoComplete={isSignup ? 'new-password' : 'current-password'} required />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPwd(v => !v)}
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${tw.textSecondary} hover:opacity-70`}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Forgot password link — only on Sign In tab */}
                {!isSignup && (
                  <div className="flex justify-end -mt-1">
                    <button type="button"
                      onClick={() => { setForgotMode(true); setForgotEmail(email); setError('') }}
                      className="text-xs text-green-500 hover:text-green-400 font-medium transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl font-semibold text-white text-sm transition-all
                    flex items-center justify-center gap-2
                    bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400
                    disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:scale-[1.01] active:scale-100">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{isSignup ? 'Creating account…' : 'Signing in…'}</>
                    : isSignup ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <p className={`text-center text-sm mt-5 ${tw.textSecondary}`}>
                {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button onClick={() => { setTab(isSignup ? 'login' : 'signup'); setError('') }}
                  className="text-green-500 hover:text-green-400 font-semibold transition-colors">
                  {isSignup ? 'Sign in' : 'Create one'}
                </button>
              </p>
            </>
          )}
        </div>

        <p className={`text-center text-xs mt-6 ${tw.textMuted}`}>
          Secured with JWT · Your data is private and per-account
        </p>
      </div>
    </div>
  )
}
