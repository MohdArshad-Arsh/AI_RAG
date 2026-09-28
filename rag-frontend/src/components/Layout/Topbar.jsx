import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore, useChatStore, useUIStore } from '../../store'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Topbar() {
  const { user, logout } = useAuthStore()
  const { resetSession } = useChatStore()
  const { resetWorkspace } = useUIStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [ddOpen, setDdOpen] = useState(false)

  const handleLogout = () => {
    queryClient.clear()
    resetSession()
    resetWorkspace()
    logout()
    navigate('/login')
    toast.success('Logged out')
  }

  return (
    <header style={{
      height: 54, background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0, zIndex: 100,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px 16px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📄</div>
        <span style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: '-0.3px',
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>RAG AI</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* User */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setDdOpen(!ddOpen)} style={{
          width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)',
          color: 'white', border: 'none', fontWeight: 700, fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
        }}>
          {user?.username?.[0]?.toUpperCase() || 'U'}
        </button>

        {ddOpen && <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setDdOpen(false)} />
          <div style={{ position: 'absolute', top: 42, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', minWidth: 200, zIndex: 300, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {user?.username || 'User'}{user?.role ? `(${user.role.charAt(0).toUpperCase() + user.role.slice(1)})` : ''}
              </div>
            </div>
            <button onClick={handleLogout} style={{
              width: '100%', padding: '10px 14px', textAlign: 'left', fontSize: 13,
              color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font)',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Sign out
            </button>
          </div>
        </>}
      </div>
    </header>
  )
}
