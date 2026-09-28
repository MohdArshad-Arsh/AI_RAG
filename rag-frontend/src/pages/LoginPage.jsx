import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore, useUIStore } from '../store'

const API_BASE = (import.meta.env.VITE_API_URL || '/api')
  .replace(/\/api\/?$/i, '')
  .replace(/\/+$/g, '')

async function apiCall(endpoint, method = 'POST', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint
  const url = `${API_BASE}/api/auth${path}`
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.detail || `HTTP ${res.status}`)
    err.detail = data.detail || `HTTP ${res.status}`
    throw err
  }
  return data
}

function getStrength(p) {
  if (!p) return null
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return [null,
    { label: 'Weak',   color: '#F7614F', w: '25%'  },
    { label: 'Fair',   color: '#F7C44F', w: '50%'  },
    { label: 'Good',   color: 'var(--accent)', w: '75%'  },
    { label: 'Strong', color: '#3DD68C', w: '100%' },
  ][s]
}

const PASS_RULES = [
  { rule: 'At least 8 characters',  test: p => p.length >= 8 },
  { rule: 'One uppercase letter',    test: p => /[A-Z]/.test(p) },
  { rule: 'One number (0-9)',        test: p => /[0-9]/.test(p) },
  { rule: 'One special character',   test: p => /[^A-Za-z0-9]/.test(p) },
]

// ─── OTP Input ────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const refs = useRef([])
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  const update = (idx, char) => {
    const next = [...digits]
    next[idx] = char.replace(/\D/g, '').slice(-1)
    onChange(next.join(''))
    if (char && idx < 5) refs.current[idx + 1]?.focus()
  }
  const onKey = (e, idx) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus()
  }
  const onPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, '').slice(0, 6))
    refs.current[Math.min(pasted.length, 5)]?.focus()
    e.preventDefault()
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input key={i} ref={el => refs.current[i] = el}
          type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={e => update(i, e.target.value)}
          onKeyDown={e => onKey(e, i)}
          onPaste={onPaste}
          style={{
            width: 46, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
            background: 'var(--surface2)', borderRadius: 10, outline: 'none',
            border: `2px solid ${d ? 'var(--accent)' : 'var(--border)'}`,
            color: 'var(--text)', boxShadow: d ? '0 0 0 3px var(--accent-soft)' : 'none',
            transition: 'all 0.15s',
          }}
        />
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function LoginPage() {
  // Forgot password states
  const [showForgot, setShowForgot] = useState(false)
  const [fpStep, setFpStep] = useState(1) // 1=username, 2=otp, 3=password
  const [fpUsername, setFpUsername] = useState("")
  const [fpMaskedEmail, setFpMaskedEmail] = useState("")
  const [suEmail, setSuEmail] = useState("")
  const [fpOtp, setFpOtp] = useState("")
  const [fpNewPass, setFpNewPass] = useState("")
  const [fpConfirm, setFpConfirm] = useState("")
  const [fpLoading, setFpLoading] = useState(false)
  const [authMode, setAuthMode]   = useState('login')
  // login fields
  const [username, setUsername]   = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [remember, setRemember]   = useState(true)
  // signup step 1 fields
  const [suUsername, setSuUsername] = useState('')
  // const [suEmail, setSuEmail]       = useState('')
  const [suPass, setSuPass]         = useState('')
  const [suConfirm, setSuConfirm]   = useState('')
  const [showSuPass, setShowSuPass] = useState(false)
  const [showSuConf, setShowSuConf] = useState(false)
  // signup step 2 — OTP
  const [signupStep, setSignupStep] = useState(1)   // 1 = form, 2 = otp
  const [otp, setOtp]               = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const [loading, setLoading] = useState(false)

  const { login, isAuthenticated } = useAuthStore()
  const { resetWorkspace } = useUIStore()
  const navigate = useNavigate()

  // Autofill forgot password username from the login form if available
  useEffect(() => {
    if (showForgot && fpStep === 1 && username.trim() && !fpUsername) {
      setFpUsername(username.trim())
    }
  }, [showForgot, fpStep, username, fpUsername])

  // appearance
  useEffect(() => {
    const saved = localStorage.getItem('remembered_username')
    if (saved) setUsername(saved)
    const mode = localStorage.getItem('colorMode') || 'light'
    const accent = localStorage.getItem('accentColor') || '#2563eb'
    const root = document.documentElement
    root.classList.remove('dark', 'dark-mode', 'auto')
    if (mode === 'dark') root.classList.add('dark', 'dark-mode')
    else if (mode === 'auto') root.classList.add('auto')
    root.style.setProperty('--accent', accent)
    const r = parseInt(accent.slice(1,3),16), g = parseInt(accent.slice(3,5),16), b = parseInt(accent.slice(5,7),16)
    root.style.setProperty('--accent-soft',  `rgba(${r},${g},${b},0.1)`)
    root.style.setProperty('--accent-soft2', `rgba(${r},${g},${b},0.18)`)
  }, [])

  useEffect(() => { if (isAuthenticated) navigate('/') }, [isAuthenticated, navigate])

  // resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // ── derived validation ──────────────────────────────────────
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suEmail)
  const strength   = getStrength(suPass)
  const passStrong = strength && ['Good', 'Strong'].includes(strength.label)
  const passMatch  = suConfirm.length > 0 && suPass === suConfirm
  const step1Ready = suUsername.trim().length >= 3 && emailValid && passStrong && passMatch

  // ── LOGIN ───────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e?.preventDefault()
    if (!username.trim() || !password.trim()) { toast.error('Please enter credentials'); return }
    setLoading(true)
    try {
      const data = await apiCall('/login', 'POST', { username: username.trim(), password })
      const user = data.user || { username: username.trim() }
      login(user, data.access_token, data.refresh_token)
      if (remember) localStorage.setItem('remembered_username', username.trim())
      else localStorage.removeItem('remembered_username')
      resetWorkspace()
      toast.success(`Welcome back, ${user.username || username}! 👋`)
      navigate('/')
    } catch (err) {
      toast.error(err.detail || 'Authentication failed')
    } finally { setLoading(false) }
  }

  // ── SIGNUP step 1: send OTP ─────────────────────────────────
  const handleSendOtp = async (e) => {
    e?.preventDefault()
    setLoading(true)
    try {
      await apiCall('/signup/send-otp', 'POST', {
        username: suUsername.trim().toLowerCase(),
        email: suEmail.trim().toLowerCase(),
        password: suPass,
        confirm_password: suConfirm,
      })
      setSignupStep(2)
      setOtp('')
      setResendCooldown(60)
      toast.success(`OTP sent to ${suEmail}`)
    } catch (err) {
      toast.error(err.detail || 'Failed to send OTP')
    } finally { setLoading(false) }
  }

  // ── SIGNUP step 2: verify OTP ───────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length < 6) { toast.error('Enter all 6 digits'); return }
    setLoading(true)
    try {
      const data = await apiCall('/signup/verify-otp', 'POST', {
        email: suEmail.trim().toLowerCase(),
        otp,
      })
      const user = data.user || { username: suUsername }
      login(user, data.access_token, data.refresh_token)
      if (remember) localStorage.setItem('remembered_username', suUsername.trim())
      resetWorkspace()
      toast.success(`Account created! Welcome, ${user.username} 🎉`)
      navigate('/')
    } catch (err) {
      toast.error(err.detail || 'OTP verification failed')
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    try {
      await apiCall('/signup/send-otp', 'POST', {
        username: suUsername.trim().toLowerCase(),
        email: suEmail.trim().toLowerCase(),
        password: suPass,
        confirm_password: suConfirm,
      })
      setOtp('')
      setResendCooldown(60)
      toast.success('New OTP sent!')
    } catch (err) {
      toast.error(err.detail || 'Failed to resend OTP')
    } finally { setLoading(false) }
  }

  const switchMode = (mode) => {
    setAuthMode(mode)
    setSignupStep(1)
    setOtp('')
    setSuUsername(''); setSuEmail(''); setSuPass(''); setSuConfirm('')
  }

  const openForgotPassword = () => {
    setFpUsername(username.trim())
    setFpMaskedEmail('')
    setFpOtp('')
    setFpNewPass('')
    setFpConfirm('')
    setFpStep(1)
    setShowForgot(true)
  }

  const resetForgotPassword = () => {
    setShowForgot(false)
    setFpStep(1)
    setFpUsername("")
    setFpMaskedEmail("")
    setFpOtp("")
    setFpNewPass("")
    setFpConfirm("")
  }

  const inp = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
  }
  const btnPrimary = (disabled) => ({
    width: '100%', padding: '11px', borderRadius: 10, border: 'none', fontWeight: 700,
    fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
    background: disabled ? 'var(--accent-soft2)' : 'var(--accent)', color: '#fff',
    boxShadow: disabled ? 'none' : '0 4px 16px var(--accent-soft2)', marginTop: 2,
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, overflowY: 'auto', display: 'flex',
      justifyContent: 'center', alignItems: 'flex-start',
      background: 'radial-gradient(ellipse at 30% 50%, var(--accent-soft) 0%, transparent 60%), var(--bg)',
      fontFamily: 'IBM Plex Sans, sans-serif', padding: '2rem 1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 20,
        padding: '36px 32px 32px', boxShadow: 'var(--shadow-lg)', margin: 'auto',
      }}>
        {/* Logo */}
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent), #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 14px', boxShadow: '0 8px 24px var(--accent-soft2)' }}>📄</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px', textAlign: 'center' }}>RAG AI</h1>
        <p style={{ fontSize: 12, color: 'var(--text4)', margin: '0 0 18px', textAlign: 'center' }}>SimpanaGlobal Risk Management AI Assistant</p>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 10, padding: 3, marginBottom: 24 }}>
          {['login', 'signup'].map(m => (
            <button key={m} type="button" onClick={() => switchMode(m)} style={{
              flex: 1, padding: '7px', borderRadius: 8, border: 'none', fontWeight: 600,
              fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
              background: authMode === m ? 'var(--accent)' : 'transparent',
              color: authMode === m ? '#fff' : 'var(--text4)',
              boxShadow: authMode === m ? '0 2px 8px var(--accent-soft2)' : 'none',
            }}>{m === 'login' ? 'Sign In' : 'Sign Up'}</button>
          ))}
        </div>

        {/* ── LOGIN FORM ── */}
        {authMode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 6 }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoComplete="username" style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" style={{ ...inp, paddingRight: 36 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text4)' }}>{showPass ? '🙈' : '👁'}</button>
              </div>
              <div style={{ textAlign: 'right', marginTop: 4 }}>
                <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }} onClick={openForgotPassword}>
                  Forgot password?
                </button>
              </div>
            </div>
            <div onClick={() => setRemember(!remember)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: remember ? 'var(--accent)' : 'transparent', border: `1.5px solid ${remember ? 'var(--accent)' : 'var(--border2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>{remember ? '✓' : ''}</div>
              <span style={{ fontSize: 12, color: 'var(--text4)' }}>Remember username</span>
            </div>
            <button type="submit" disabled={loading} style={btnPrimary(loading)}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Forgot password modal */}
        {showForgot && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px #0002', padding: 32, minWidth: 320, maxWidth: '90vw', position: 'relative' }}>
              <button type="button" onClick={resetForgotPassword} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 18, color: '#888', cursor: 'pointer' }}>×</button>
              {fpStep === 1 && (
                <form onSubmit={async e => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!fpUsername.trim()) {
                    toast.error('Enter your username first')
                    return
                  }
                  setFpLoading(true)
                  try {
                    const data = await apiCall('/forgot-password/request', 'POST', { username: fpUsername.trim().toLowerCase() })
                    setFpMaskedEmail(data.masked_email || '')
                    toast.success(data.message || 'OTP sent to your registered email')
                    setFpStep(2)
                  } catch (err) {
                    toast.error(err.detail || 'Failed to send OTP')
                  } finally {
                    setFpLoading(false)
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <h2 style={{ fontSize: 18, margin: 0 }}>Forgot Password</h2>
                  <input type="text" value={fpUsername} onChange={e => setFpUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" style={inp} required />
                  <button type="submit" style={btnPrimary(fpLoading)} disabled={fpLoading}>{fpLoading ? 'Sending...' : 'Send OTP'}</button>
                </form>
              )}
              {fpStep === 2 && (
                <form onSubmit={async e => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (fpOtp.trim().length < 6) {
                    toast.error('Enter the 6-digit OTP')
                    return
                  }
                  setFpLoading(true)
                  try {
                    const data = await apiCall('/forgot-password/verify-otp', 'POST', {
                      username: fpUsername.trim().toLowerCase(),
                      otp: fpOtp.trim()
                    })
                    toast.success(data.message || 'OTP verified')
                    setFpStep(3)
                  } catch (err) {
                    toast.error(err.detail || 'Invalid OTP')
                  } finally {
                    setFpLoading(false)
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 style={{ fontSize: 18, margin: 0 }}>Verify OTP</h2>
                  {fpMaskedEmail && <p style={{ fontSize: 12, margin: 0, color: '#666' }}>OTP sent to {fpMaskedEmail}</p>}
                  <input type="text" value={fpOtp} onChange={e => setFpOtp(e.target.value)} placeholder="Enter OTP" style={inp} required maxLength={6} />
                  <button type="submit" style={btnPrimary(fpLoading)} disabled={fpLoading}>{fpLoading ? 'Verifying...' : 'Verify OTP'}</button>
                  <button type="button" style={{ ...btnPrimary(false), background: 'var(--surface2)', color: 'var(--text3)', marginTop: 4 }} onClick={() => setFpStep(1)}>Back</button>
                </form>
              )}
              {fpStep === 3 && (
                <form onSubmit={async e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setFpLoading(true)
                  try {
                    const data = await apiCall('/forgot-password/reset', 'POST', {
                      username: fpUsername.trim().toLowerCase(),
                      new_password: fpNewPass,
                      confirm_password: fpConfirm
                    })
                    toast.success(data.message || 'Password changed successfully')
                    resetForgotPassword()
                    navigate('/login', { replace: true })
                  } catch (err) {
                    toast.error(err.detail || 'Failed to change password')
                  } finally {
                    setFpLoading(false)
                  }
                }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 style={{ fontSize: 18, margin: 0 }}>Change Password</h2>
                  <input type="password" value={fpNewPass} onChange={e => setFpNewPass(e.target.value)} placeholder="New password" style={inp} required />
                  <input type="password" value={fpConfirm} onChange={e => setFpConfirm(e.target.value)} placeholder="Confirm new password" style={inp} required />
                  <button type="submit" style={btnPrimary(fpLoading)} disabled={fpLoading}>{fpLoading ? 'Changing...' : 'Change Password'}</button>
                  <button type="button" style={{ ...btnPrimary(false), background: 'var(--surface2)', color: 'var(--text3)', marginTop: 4 }} onClick={() => setFpStep(2)}>Back</button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── SIGNUP STEP 1: FORM ── */}
        {authMode === 'signup' && signupStep === 1 && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 6 }}>Username</label>
              <input type="text" value={suUsername} onChange={e => setSuUsername(e.target.value)} placeholder="min. 3 characters" autoComplete="username" style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 6 }}>Email</label>
              <input type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"
                style={{ ...inp, borderColor: suEmail.length > 0 ? (emailValid ? '#3DD68C' : '#F7614F') : 'var(--border)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showSuPass ? 'text' : 'password'} value={suPass} onChange={e => setSuPass(e.target.value)} placeholder="Enter password" autoComplete="new-password" style={{ ...inp, paddingRight: 36 }} />
                <button type="button" onClick={() => setShowSuPass(!showSuPass)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text4)' }}>{showSuPass ? '🙈' : '👁'}</button>
              </div>
              {suPass && strength && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: strength.w, background: strength.color, borderRadius: 2, transition: 'all 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: strength.color, marginTop: 3, display: 'block' }}>Strength: {strength.label}</span>
                </div>
              )}
            </div>
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {PASS_RULES.map(({ rule, test }) => (
                <div key={rule} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <span style={{ color: suPass ? (test(suPass) ? '#3DD68C' : '#F7614F') : 'var(--text4)', fontWeight: 700 }}>{suPass ? (test(suPass) ? '✓' : '✗') : '○'}</span>
                  <span style={{ color: suPass ? (test(suPass) ? 'var(--text2)' : 'var(--text4)') : 'var(--text4)' }}>{rule}</span>
                </div>
              ))}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 6 }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showSuConf ? 'text' : 'password'} value={suConfirm} onChange={e => setSuConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password"
                  style={{ ...inp, paddingRight: 56, borderColor: suConfirm ? (passMatch ? '#3DD68C' : '#F7614F') : 'var(--border)' }} />
                <button type="button" onClick={() => setShowSuConf(!showSuConf)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text4)' }}>{showSuConf ? '🙈' : '👁'}</button>
                {suConfirm && <span style={{ position: 'absolute', right: 34, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>{passMatch ? '✅' : '❌'}</span>}
              </div>
            </div>
            <button type="submit" disabled={loading || !step1Ready} style={btnPrimary(loading || !step1Ready)}>
              {loading ? 'Sending OTP...' : 'Send Verification Code →'}
            </button>
          </form>
        )}

        {/* ── SIGNUP STEP 2: OTP ── */}
        {authMode === 'signup' && signupStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* back button */}
            <button type="button" onClick={() => { setSignupStep(1); setOtp('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', padding: 0, width: 'fit-content' }}>
              ← Back
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📩</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Check your email</div>
              <div style={{ fontSize: 12, color: 'var(--text4)', lineHeight: 1.7 }}>
                We sent a 6-digit code to<br />
                <strong style={{ color: 'var(--accent)' }}>{suEmail}</strong>
              </div>
            </div>

            <OtpInput value={otp} onChange={setOtp} />

            <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6} style={btnPrimary(loading || otp.length < 6)}>
              {loading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text4)' }}>
              Didn't receive it?{' '}
              <button onClick={handleResend} disabled={resendCooldown > 0 || loading}
                style={{ background: 'none', border: 'none', fontSize: 12, cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', color: resendCooldown > 0 ? 'var(--text4)' : 'var(--accent)', fontWeight: 600, padding: 0 }}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
