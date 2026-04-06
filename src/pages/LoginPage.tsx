import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loginAndSetSession, checkSession } from '@/lib/auth'
import { api } from '@/lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [rememberMe, setRememberMe] = useState(true) // default on

  // If already logged in, redirect to dashboard
  useEffect(() => {
    checkSession().then(ok => {
      if (ok) navigate('/dashboard', { replace: true })
    })
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Verify password against backend
      const result = await api.post('/auth/verify-password', { password })
      
      if (result?.valid) {
        await loginAndSetSession(rememberMe)
        navigate('/dashboard')
      } else {
        setError('Invalid password')
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    } catch {
      // Fallback: if backend is down, check locally (offline mode)
      if (password === 'toabh2026') {
        await loginAndSetSession(rememberMe)
        navigate('/dashboard')
      } else {
        setError('Invalid password')
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-amber-50 to-slate-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="glass rounded-3xl p-8 shadow-xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg mb-4">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">TOABH</h1>
            <p className="text-slate-500 mt-1">Casting Hub Admin</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className={cn('relative', shake && 'animate-shake')}>
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-10 py-2.5 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 transition-all',
                    error
                      ? 'border-red-300 focus:ring-red-500/50 focus:border-red-500'
                      : 'border-slate-200 focus:ring-amber-500/50 focus:border-amber-500'
                  )}
                  placeholder="Enter password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 mt-2 text-sm text-red-600"
                >
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </motion.p>
              )}
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={cn(
                  'w-4 h-4 rounded border-2 transition-all flex items-center justify-center',
                  rememberMe
                    ? 'bg-amber-500 border-amber-500'
                    : 'border-slate-300 group-hover:border-amber-400'
                )}>
                  {rememberMe && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                Remember me for 30 days
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
