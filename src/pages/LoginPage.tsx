import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, Lock, AlertCircle, Loader2, Mail, ArrowLeft } from 'lucide-react'
import { login, forgotPassword, resetPassword, isLoggedIn } from '@/lib/api'

function ToabhLogo({ size = 56 }: { size?: number }) {
  const [imgError, setImgError] = useState(false)

  if (imgError) {
    return (
      <div
        className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg"
        style={{ width: size, height: size }}
      >
        <span className="text-white font-bold" style={{ fontSize: size * 0.375 }}>T</span>
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
  const [searchParams] = useSearchParams()
  const isReset = searchParams.get('reset') === '1'
  const resetToken = searchParams.get('token') || ''
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
    // When auth is disabled, redirect directly to dashboard
    if (import.meta.env.VITE_AUTH_DISABLED === 'true') {
      navigate('/dashboard', { replace: true })
      return
    }
    if (isLoggedIn() && mode === 'login') navigate('/dashboard', { replace: true })
  }, [mode, navigate])

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500) }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!identifier.trim() || !password) { setError('Enter your username/email and password'); triggerShake(); return }
    setLoading(true)
    try {
      await login(identifier.trim(), password, remember)
      navigate('/dashboard', { replace: true })
    } catch (err: any) { setError(err.message || 'Invalid credentials'); triggerShake() }
    finally { setLoading(false) }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('')
    if (!forgotEmail.trim()) { setError('Enter your email address'); return }
    setLoading(true)
    try {
      await forgotPassword(forgotEmail.trim())
      setSuccess('If an account exists, a reset link has been sent.')
      setForgotEmail('')
    } catch (err: any) { setError(err.message || 'Failed to send reset email') }
    finally { setLoading(false) }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('')
    if (!resetPw || resetPw.length < 6) { setError('Password must be at least 6 characters'); return }
    if (resetPw !== resetPwConfirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await resetPassword(resetToken, resetPw)
      setSuccess('Password updated! Redirecting to login\u2026')
      setResetPw(''); setResetPwConfirm('')
      setTimeout(() => setMode('login'), 2000)
    } catch (err: any) { setError(err.message || 'Failed to reset password') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-amber-50 to-slate-100 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="glass rounded-3xl p-8 shadow-xl">
              <div className="flex flex-col items-center mb-8">
                <ToabhLogo size={56} />
                <h1 className="text-2xl font-bold text-slate-900 mt-4">TOABH Casting Hub</h1>
                <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Username or Email</label>
                  <div className={`relative ${shake ? 'animate-shake' : ''}`}>
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Enter username or email" autoFocus className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 border-slate-200 focus:ring-amber-500/50 focus:border-amber-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className={`relative ${shake ? 'animate-shake' : ''}`}>
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="w-full pl-10 pr-10 py-2.5 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 border-slate-200 focus:ring-amber-500/50 focus:border-amber-500" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 transition-colors">{showPassword ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}</button>
                  </div>
                </div>
                <AnimatePresence>{error && (<motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{error}</motion.p>)}</AnimatePresence>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" />Remember me</label>
                  <button type="button" onClick={() => { setMode('forgot'); setError('') }} className="text-sm text-amber-600 hover:text-amber-700 font-medium">Forgot password?</button>
                </div>
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
                </button>
              </form>
            </motion.div>
          )}

          {mode === 'forgot' && (
            <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass rounded-3xl p-8 shadow-xl">
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"><ArrowLeft className="w-4 h-4" />Back to login</button>
              <div className="flex flex-col items-center mb-6">
                <ToabhLogo size={44} />
                <h2 className="text-xl font-bold text-slate-900 mt-3">Reset Password</h2>
                <p className="text-sm text-slate-500 mt-1 text-center">Enter your email and we'll send a reset link.</p>
              </div>
              <form onSubmit={handleForgot} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label><input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="you@example.com" autoFocus className="w-full px-4 py-2.5 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 border-slate-200 focus:ring-amber-500/50 focus:border-amber-500" /></div>
                <AnimatePresence>
                  {error && (<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{error}</motion.p>)}
                  {success && (<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-emerald-600 font-medium">{success}</motion.p>)}
                </AnimatePresence>
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}</button>
              </form>
            </motion.div>
          )}

          {mode === 'reset' && (
            <motion.div key="reset" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-8 shadow-xl">
              <div className="flex flex-col items-center mb-6">
                <ToabhLogo size={44} />
                <h2 className="text-xl font-bold text-slate-900 mt-3">Set New Password</h2>
                <p className="text-sm text-slate-500 mt-1">Enter your new password below.</p>
              </div>
              <form onSubmit={handleReset} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label><input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="At least 6 characters" autoFocus className="w-full px-4 py-2.5 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 border-slate-200 focus:ring-amber-500/50 focus:border-amber-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label><input type="password" value={resetPwConfirm} onChange={e => setResetPwConfirm(e.target.value)} placeholder="Repeat password" className="w-full px-4 py-2.5 border rounded-xl bg-white/50 focus:outline-none focus:ring-2 border-slate-200 focus:ring-amber-500/50 focus:border-amber-500" /></div>
                <AnimatePresence>
                  {error && (<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{error}</motion.p>)}
                  {success && (<motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-emerald-600 font-medium">{success}</motion.p>)}
                </AnimatePresence>
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}</button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
