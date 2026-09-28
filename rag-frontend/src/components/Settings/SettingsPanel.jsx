import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

function getSystemPref() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(mode) {
  const root = document.documentElement
  root.classList.remove('dark', 'dark-mode', 'auto')
  if (mode === 'dark') { root.classList.add('dark', 'dark-mode'); document.body.style.background = '#171717' }
  else if (mode === 'auto') { root.classList.add('auto'); document.body.style.background = getSystemPref() === 'dark' ? '#171717' : '#f3f4f6' }
  else { document.body.style.background = '#f3f4f6' }
  localStorage.setItem('colorMode', mode)
}

function applyFontSize(key) {
  const map = { small: '13px', medium: '14px', large: '16px' }
  const px = map[key] || '14px'
  document.documentElement.style.setProperty('--font-size', px)
  document.documentElement.style.fontSize = px
  document.body.style.fontSize = px
  localStorage.setItem('fontSize', key)
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--accent', color)
  const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16)
  document.documentElement.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.1)`)
  document.documentElement.style.setProperty('--accent-soft2', `rgba(${r},${g},${b},0.18)`)
  localStorage.setItem('accentColor', color)
}

function AppearanceSection() {
  const [mode, setMode] = useState(() => localStorage.getItem('colorMode') || 'light')
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'medium')
  const [accent, setAccent] = useState(() => localStorage.getItem('accentColor') || '#2563eb')

  useEffect(() => { applyTheme(mode); applyFontSize(fontSize); applyAccent(accent) }, [])

  const pickMode = (m) => { setMode(m); applyTheme(m); toast.success(`${m.charAt(0).toUpperCase() + m.slice(1)} mode`) }
  const pickSize = (k) => { setFontSize(k); applyFontSize(k); toast.success(`Font: ${k.charAt(0).toUpperCase() + k.slice(1)}`) }
  const pickAccent = (c) => { setAccent(c); applyAccent(c); toast.success('Accent colour updated') }

  const modes = [
    { id: 'light', icon: '☀️', label: 'Light', desc: 'White background', bgPreview: '#f3f4f6', sidePreview: '#fff' },
    { id: 'auto', icon: '💻', label: 'Device', desc: 'Follows your OS setting', bgPreview: 'linear-gradient(135deg,#f3f4f6 50%,#171717 50%)', sidePreview: '#ccc' },
    { id: 'dark', icon: '🌙', label: 'Dark', desc: 'Dark background', bgPreview: '#171717', sidePreview: '#1a1a1a' },
  ]

  const ACCENTS = [
    { color: '#2563eb', name: 'Blue' },
    { color: '#7c3aed', name: 'Purple' },
    { color: '#059669', name: 'Green' },
    { color: '#dc2626', name: 'Red' },
    { color: '#d97706', name: 'Amber' },
    { color: '#0891b2', name: 'Cyan' },
    { color: '#db2777', name: 'Pink' },
    { color: '#65a30d', name: 'Lime' },
  ]

  const SIZES = [['small', 'Small', '13px'], ['medium', 'Medium', '14px'], ['large', 'Large', '16px']]

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Appearance</h2>
      <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28 }}>Customise how RAG AI looks on your screen</p>

      {/* ── Colour Mode ── */}
      <section style={{ marginBottom: 32 }}>
        <label style={labelStyle}>Colour Mode</label>
        <div style={{ display: 'inline-flex', background: 'var(--surface3)', borderRadius: 10, padding: 4, gap: 2, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          {modes.map(m => (
            <button key={m.id} onClick={() => pickMode(m.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
              borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: mode === m.id ? 'var(--surface)' : 'transparent',
              color: mode === m.id ? 'var(--text)' : 'var(--text3)',
              boxShadow: mode === m.id ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.18s',
            }}>
              {mode === m.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {modes.map(m => (
            <div key={m.id} onClick={() => pickMode(m.id)} style={{
              flex: 1, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
              border: `2px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`,
              boxShadow: mode === m.id ? '0 0 0 3px var(--accent-soft)' : 'var(--shadow-sm)',
              transition: 'all 0.18s', position: 'relative',
            }}>
              <div style={{ height: 70, background: m.bgPreview, display: 'flex' }}>
                <div style={{ width: 18, background: m.sidePreview, borderRight: '1px solid rgba(128,128,128,0.15)', display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 3px' }}>
                  {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 4, borderRadius: 2, background: i === 0 ? 'var(--accent)' : 'rgba(128,128,128,0.25)' }} />)}
                </div>
                <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ height: 5, width: '55%', borderRadius: 3, background: 'var(--accent)', opacity: 0.8 }} />
                  <div style={{ height: 4, width: '80%', borderRadius: 3, background: 'rgba(128,128,128,0.2)' }} />
                  <div style={{ height: 4, width: '65%', borderRadius: 3, background: 'rgba(128,128,128,0.15)' }} />
                  <div style={{ marginTop: 'auto', height: 10, width: '100%', borderRadius: 4, background: 'rgba(128,128,128,0.1)' }} />
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: mode === m.id ? 'var(--accent)' : 'var(--text)' }}>{m.icon} {m.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 2 }}>{m.desc}</div>
                </div>
                {mode === m.id && <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Accent Colour ── */}
      <section style={{ marginBottom: 32 }}>
        <label style={labelStyle}>Accent Colour</label>
        <p style={{ fontSize: 12, color: 'var(--text4)', marginBottom: 12 }}>Applies to buttons, links, highlights and active states throughout the app</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {ACCENTS.map(a => (
            <button key={a.color} onClick={() => pickAccent(a.color)} title={a.name} style={{
              width: 36, height: 36, borderRadius: '50%', background: a.color, border: 'none', cursor: 'pointer',
              outline: accent === a.color ? `3px solid ${a.color}` : '3px solid transparent',
              outlineOffset: 2, transition: 'all 0.15s', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            />
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button style={{ padding: '7px 14px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: 'white', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Primary Button</button>
          <button style={{ padding: '7px 14px', borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--accent)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>Outline Button</button>
          <span style={{ padding: '3px 10px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, border: '1px solid var(--accent-soft2)', alignSelf: 'center' }}>Badge</span>
        </div>
      </section>

      {/* ── Font Size ── */}
      <section style={{ marginBottom: 32 }}>
        <label style={labelStyle}>Font Size</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {SIZES.map(([key, label, px]) => {
            const isActive = fontSize === key
            return (
              <button key={key} onClick={() => pickSize(key)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '12px 20px', borderRadius: 'var(--radius)', cursor: 'pointer',
                border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border2)'}`,
                background: isActive ? 'var(--accent-soft)' : 'var(--surface2)',
                transition: 'all 0.15s', position: 'relative',
              }}>
                <span style={{ fontSize: key === 'small' ? 13 : key === 'medium' ? 16 : 20, fontWeight: 600, color: 'var(--text)' }}>Aa</span>
                <span style={{ fontSize: 11, color: isActive ? 'var(--accent)' : 'var(--text3)', fontWeight: isActive ? 600 : 400 }}>{label}</span>
                <span style={{ fontSize: 10, color: 'var(--text4)', fontFamily: 'monospace' }}>{px}</span>
                {isActive && (
                  <div style={{ position: 'absolute', top: -9, right: 6, background: 'var(--accent)', color: 'white', fontSize: 9, padding: '1px 6px', borderRadius: 999, fontWeight: 700 }}>✓ Active</div>
                )}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text4)', marginBottom: 12 }

// ── Main Settings Panel ─────────────────────────────────────
export default function SettingsPanel() {
  const [active, setActive] = useState('appearance')

  const navGroups = [
    { group: 'Account', items: [{ id: 'profile', label: '👤 Profile' }, { id: 'api', label: '🔑 API Keys' }] },
    { group: 'AI Config', items: [{ id: 'llm', label: '🤖 LLM Model' }] },
    { group: 'System', items: [{ id: 'appearance', label: '🎨 Appearance' }] },
  ]

  const InputRow = ({ label, defaultValue }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text3)', marginBottom: 6, fontWeight: 500 }}>{label}</label>
      <input defaultValue={defaultValue} style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)' }}
        onBlur={e => { e.target.style.borderColor = 'var(--border2)'; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Nav */}
      <div style={{ width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '16px 10px', gap: 2, overflowY: 'auto', flexShrink: 0 }}>
        {navGroups.map(g => (
          <div key={g.group} style={{ marginBottom: 8 }}>
            <div style={{ padding: '4px 12px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text4)' }}>{g.group}</div>
            {g.items.map(item => (
              <button key={item.id} onClick={() => setActive(item.id)} style={{
                width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 'var(--radius)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                background: active === item.id ? 'var(--accent-soft)' : 'transparent',
                color: active === item.id ? 'var(--accent)' : 'var(--text3)',
                transition: 'all 0.15s', marginBottom: 2,
                borderLeft: `3px solid ${active === item.id ? 'var(--accent)' : 'transparent'}`,
              }}
                onMouseEnter={e => { if (active !== item.id) { e.currentTarget.style.background = 'var(--surface3)'; e.currentTarget.style.color = 'var(--text)' } }}
                onMouseLeave={e => { if (active !== item.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' } }}
              >{item.label}</button>
            ))}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        {active === 'appearance' && <AppearanceSection />}

        {active === 'profile' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>👤 User Profile</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 560 }}>
              <InputRow label="Full Name" defaultValue="Grm Test User" />
              <InputRow label="Email" defaultValue="grm_test_user@oracle.com" />
              <InputRow label="Role" defaultValue="Risk Reviewer" />
              <InputRow label="Region" defaultValue="APAC" />
            </div>
            <button onClick={() => toast.success('Profile saved')} style={{ padding: '9px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginTop: 8 }}>Save Changes</button>
          </div>
        )}

        {active === 'api' && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>🔑 API Settings</h2>
            <InputRow label="API Base URL" defaultValue="/api" />
            <InputRow label="API Key" defaultValue="sk-••••••••••••••••" />
            <InputRow label="Timeout (ms)" defaultValue="60000" />
            <button onClick={() => toast.success('API settings saved')} style={{ padding: '9px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Save</button>
          </div>
        )}

        {active === 'llm' && (
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>🤖 LLM Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <InputRow label="LLM Model" defaultValue="GPT-4o" />
              <InputRow label="Embedding Model" defaultValue="text-embedding-3-large" />
              <InputRow label="Max Tokens" defaultValue="4000" />
              <InputRow label="Temperature" defaultValue="0.7" />
            </div>
            <button onClick={() => toast.success('LLM settings saved')} style={{ padding: '9px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginTop: 8 }}>Save</button>
          </div>
        )}
      </div>
    </div>
  )
}