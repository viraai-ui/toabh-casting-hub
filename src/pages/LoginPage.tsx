import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react'
import { login, forgotPassword, resetPassword, checkSession } from '@/lib/api'

interface ErrorWithMessage {
  message?: string
}

function ToabhLogo({ size = 56 }: { size?: number }) {
  const [imgError, setImgError] = useState(false)

  if (imgError) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg"
        style={{ width: size, height: size }}
      >
        <span className="font-bold text-white" style={{ fontSize: size * 0.375 }}>T</span>
      </div>
    )
  }

  return (
    <img
      src="/TOABH NEW.png"
      alt="TOABH"
      className="object-contain drop-shadow-lg"
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
    />
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isReset = location.pathname === '/reset-password' || searchParams.get('reset') === '1'
  const resetToken = searchParams.get('token') || ''
  const loginErrorFromUrl = searchParams.get('error') || ''
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(isReset ? 'reset' : 'login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetPw, setResetPw] = useState('')
  const [resetPwConfirm, setResetPwConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (isReset) return

    if (loginErrorFromUrl) {
      setError(loginErrorFromUrl)
    }

    checkSession().then((ok) => {
      if (!cancelled && ok) {
        navigate('/dashboard', { replace: true })
      }
    })

    return () => {
      cancelled = true
    }
  }, [isReset, loginErrorFromUrl, navigate])

  const triggerShake = () => {
    setShake(true)
    window.setTimeout(() => setShake(false), 500)
  }

  const submitLoginFallback = (username: string, passwordValue: string, shouldRemember: boolean) => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/auth/login'
    form.style.display = 'none'

    const fields = {
      username,
      password: passwordValue,
      remember: shouldRemember ? 'true' : 'false',
    }

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    })

    document.body.appendChild(form)
    form.submit()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!identifier.trim() || !password) {
      setError('Enter your username/email and password')
      triggerShake()
      return
    }
    setLoading(true)
    try {
      await login(identifier.trim(), password, remember)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const error = err as ErrorWithMessage
      const message = error.message || 'Invalid credentials'
      const networkLikeFailure = /failed to fetch|request failed|could not reach the server|refresh once and try again/i.test(message)

      if (networkLikeFailure) {
        submitLoginFallback(identifier.trim(), password, remember)
        return
      }

      setError(message)
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!forgotEmail.trim()) {
      setError('Enter your email address')
      return
    }
    setLoading(true)
    try {
      await forgotPassword(forgotEmail.trim())
      setSuccess('If an account exists, a reset link has been sent.')
      setForgotEmail('')
    } catch (err: unknown) {
      const error = err as ErrorWithMessage
      setError(error.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!resetPw || resetPw.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (resetPw !== resetPwConfirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await resetPassword(resetToken, resetPw)
      setSuccess('Password updated! Redirecting to login…')
      setResetPw('')
      setResetPwConfirm('')
      window.setTimeout(() => {
        setMode('login')
        navigate('/login', { replace: true })
      }, 2000)
    } catch (err: unknown) {
      const error = err as ErrorWithMessage
      setError(error.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-br from-slate-100 via-amber-50 to-slate-100 px-4 py-6 sm:flex sm:items-center sm:justify-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto my-4 w-full max-w-sm sm:my-0">
        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="glass rounded-[2rem] border border-white/60 p-8 shadow-2xl shadow-slate-200/70 backdrop-blur-xl">
              <div className="mb-8 flex flex-col items-center text-center">
                <ToabhLogo size={76} />
                <div className="mt-5 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                  TOABH Talent OS
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Welcome back</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to manage castings, team workflows, and daily operations.</p>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-left shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Access</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Admin and invited team sign-in</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-left shadow-sm">
                  <div className="flex items-center gap-2 text-amber-700">
                    <ShieldCheck className="h-4 w-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Security note</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">Use your assigned work identity, not a shared credential.</p>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-xs leading-5 text-amber-900">
                <div className="font-semibold">Admin sign-in</div>
                <div className="mt-1 text-amber-800/90">Use your assigned username or work email. Team members can also sign in with invite credentials.</div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Username or Email</label>
                  <div className={`relative ${shake ? 'animate-shake' : ''}`}>
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="admin or name@toabh.com" autoFocus className="w-full rounded-xl border border-slate-200 bg-white/70 py-3 pl-10 pr-4 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                  <div className={`relative ${shake ? 'animate-shake' : ''}`}>
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full rounded-xl border border-slate-200 bg-white/70 py-3 pl-10 pr-10 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 transition-colors hover:bg-slate-100">{showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}</button>
                  </div>
                </div>
                <AnimatePresence>{error && (<motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</motion.p>)}</AnimatePresence>
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" />Remember me</label>
                  <button type="button" onClick={() => { setMode('forgot'); setError('') }} className="text-sm font-medium text-amber-600 hover:text-amber-700">Forgot password?</button>
                </div>
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-600 py-3 font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:shadow-slate-900/30 disabled:opacity-60">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
                </button>
              </form>
            </motion.div>
          )}

          {mode === 'forgot' && (
            <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass rounded-3xl border border-white/60 p-8 shadow-xl">
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} className="mb-6 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" />Back to login</button>
              <div className="mb-6 flex flex-col items-center">
                <ToabhLogo size={60} />
                <h2 className="mt-3 text-xl font-bold text-slate-900">Reset password</h2>
                <p className="mt-1 text-center text-sm text-slate-500">Enter your email and we&apos;ll send a reset link.</p>
              </div>
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                  <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" autoFocus className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <AnimatePresence>
                  {error && (<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</motion.p>)}
                  {success && (<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-emerald-600">{success}</motion.p>)}
                </AnimatePresence>
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30 disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send Reset Link'}</button>
              </form>
            </motion.div>
          )}

          {mode === 'reset' && (
            <motion.div key="reset" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl border border-white/60 p-8 shadow-xl">
              <div className="mb-6 flex flex-col items-center">
                <ToabhLogo size={60} />
                <h2 className="mt-3 text-xl font-bold text-slate-900">Set new password</h2>
                <p className="mt-1 text-sm text-slate-500">Enter your new password below.</p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">New Password</label>
                  <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="At least 6 characters" autoFocus className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm Password</label>
                  <input type="password" value={resetPwConfirm} onChange={(e) => setResetPwConfirm(e.target.value)} placeholder="Repeat password" className="w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <AnimatePresence>
                  {error && (<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</motion.p>)}
                  {success && (<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-medium text-emerald-600">{success}</motion.p>)}
                </AnimatePresence>
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2.5 font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30 disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset Password'}</button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
