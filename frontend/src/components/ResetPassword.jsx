import React, { useState } from 'react'
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Sun, Moon } from 'lucide-react'
import api from '../utils/api'
import { useTheme } from '../ThemeContext'

export default function ResetPassword({ token, onBackToLogin }) {
  const { isDark, toggleTheme, tw } = useTheme()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)

  const inp = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
    isDark
      ? 'bg-slate-700/60 border-slate-600 text-white placeholder-slate-400 focus:border-green-500 focus:ring-1 focus:ring-green-500/30'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500/30'
  }`

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      await api.post('/reset-password', { token, new_password: password })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${tw.root}`}>

      {/* Theme toggle */}
      <button onClick={toggleTheme}
        className={`fixed top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${tw.uploadReset}`}>
        {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
        <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <picture>
              <source srcSet="/moeving-logo.png" type="image/png" />
              <img src="/moeving-logo.svg" alt="Moeving" className="h-12 w-auto object-contain"
                onError={e => { e.target.style.display = 'none' }} />
            </picture>
          </div>
          <h1 className={`text-2xl font-bold ${tw.textPrimary}`}>Set new password</h1>
          <p className={`mt-1 text-sm ${tw.textSecondary}`}>
            Choose a strong password for your account
          </p>
        </div>

        <div className={`${tw.card} rounded-2xl p-8 shadow-2xl`}>
          {success ? (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
              </div>
              <div>
                <p className={`font-semibold text-lg ${tw.textPrimary}`}>Password updated!</p>
                <p className={`text-sm mt-1 ${tw.textSecondary}`}>
                  Your password has been changed successfully.
                </p>
              </div>
              <button
                onClick={onBackToLogin}
                className="w-full py-3.5 rounded-xl font-semibold text-white text-sm
                  bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400
                  transition-all shadow-lg hover:scale-[1.01] active:scale-100">
                Sign in with new password
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${tw.textSecondary}`} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="New password (min 6 chars)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inp} pl-10 pr-10`}
                  autoComplete="new-password"
                  required
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPwd(v => !v)}
                  className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${tw.textSecondary} hover:opacity-70`}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${tw.textSecondary}`} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={`${inp} pl-10`}
                  autoComplete="new-password"
                  required
                />
              </div>

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
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating password…</>
                  : 'Update password'}
              </button>

              <p className={`text-center text-sm mt-2 ${tw.textSecondary}`}>
                Remember it?{' '}
                <button type="button" onClick={onBackToLogin}
                  className="text-green-500 hover:text-green-400 font-semibold transition-colors">
                  Sign in
                </button>
              </p>
            </form>
          )}
        </div>

        <p className={`text-center text-xs mt-6 ${tw.textMuted}`}>
          Secured with JWT · Your data is private and per-account
        </p>
      </div>
    </div>
  )
}
