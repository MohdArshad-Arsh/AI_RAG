import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDocuments } from '../../hooks'
import { useChatStore, useUIStore } from '../../store'
import toast from 'react-hot-toast'
import { documentsAPI } from '../../services/api'
import DocumentViewer from './DocumentViewer'

// ── SVG Icons ─────────────────────────────────────────────────
const Icon = {
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>,
  upload: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  chat: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  reindex: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>,
}

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    Completed: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', border: 'rgba(22,163,74,0.25)' },
    Failed: { bg: 'rgba(220,38,38,0.08)', color: '#dc2626', border: 'rgba(220,38,38,0.25)' },
    Processing: { bg: 'rgba(202,138,4,0.1)', color: '#b45309', border: 'rgba(202,138,4,0.25)' },
  }
  const s = map[status] || map.Processing
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`
    }}>
      {status}
    </span>
  )
}

// ── Action Button ─────────────────────────────────────────────
function ActionBtn({ onClick, icon, label, variant = 'default', loading = false }) {
  const map = {
    default: { color: 'var(--text3)', bgH: 'var(--surface3)', bH: 'var(--border2)' },
    primary: { color: 'var(--accent)', bgH: 'var(--accent-soft)', bH: 'var(--accent)' },
    danger: { color: '#dc2626', bgH: 'rgba(220,38,38,0.08)', bH: 'rgba(220,38,38,0.4)' },
    warn: { color: '#b45309', bgH: 'rgba(202,138,4,0.08)', bH: 'rgba(202,138,4,0.4)' },
    success: { color: '#16a34a', bgH: 'rgba(22,163,74,0.08)', bH: 'rgba(22,163,74,0.4)' },
  }
  const v = map[variant]
  return (
    <button onClick={onClick} disabled={loading} title={label} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 30, height: 30, borderRadius: 'var(--radius-sm, 6px)',
      border: '1px solid var(--border)', background: 'var(--surface)',
      color: v.color, cursor: loading ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s', flexShrink: 0, opacity: loading ? 0.5 : 1,
    }}
      onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = v.bgH; e.currentTarget.style.borderColor = v.bH } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {loading
        ? <div style={{ width: 10, height: 10, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        : icon}
    </button>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteModal({ doc, onConfirm, onCancel, loading }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, width: 380, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', marginBottom: 14, fontSize: 18 }}>🗑</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Delete Document?</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 20 }}>
            Permanently delete <strong style={{ color: 'var(--text)' }}>{doc.name}</strong>?<br />This cannot be undone.
          </div>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.7 : 1 }}>
            {loading ? <><div style={{ width: 12, height: 12, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Deleting…</> : '🗑 Delete'}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export default function DocumentsPanel() {
  const qc = useQueryClient()
  const { data: docs = [], isLoading } = useDocuments()
  const { setActiveDocument, activeDocument, clearMessages } = useChatStore()
  const { setPanel, openUploadModal } = useUIStore()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [viewingDoc, setViewingDoc] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingName, setDeletingName] = useState(null)
  const [downloadingName, setDownloadingName] = useState(null)

  const filtered = docs.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const openChat = (doc) => { setActiveDocument(doc); setPanel('chat') }
  const handleView = (doc) => setViewingDoc(doc)

  // ── DOWNLOAD ───────────────────────────────────────────────
  const handleDownload = async (doc) => {
    if (downloadingName === doc.name) return
    setDownloadingName(doc.name)
    try {
      const res = await documentsAPI.download(doc.name)
      const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = doc.name
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Downloaded: ${doc.name}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Download failed')
    } finally { setDownloadingName(null) }
  }

  // ── DELETE ─────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeletingName(deleteTarget.name)
    try {
      await documentsAPI.delete(deleteTarget.id)
      qc.invalidateQueries({ queryKey: ['documents'] })
      if (activeDocument?.name === deleteTarget.name || activeDocument?.id === deleteTarget.id) {
        setActiveDocument(null)
        clearMessages()
      }
      toast.success(`Deleted: ${deleteTarget.name}`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed')
    } finally { setDeletingName(null) }
  }

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const allSelected = filtered.length > 0 && filtered.every(d => selected.has(d.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', flexShrink: 0 }}>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <span style={{ position: 'absolute', left: 10, color: 'var(--text4)', display: 'flex', pointerEvents: 'none' }}>{Icon.search}</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            style={{ paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, borderRadius: 'var(--radius,8px)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, outline: 'none', width: 220 }}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)'; e.target.style.background = 'var(--surface)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border2)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--surface2)' }}
          />
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.success('Refreshed') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius,8px)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text3)', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
        >{Icon.refresh} Refresh</button>

        <button
          onClick={openUploadModal}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius,8px)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.9)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'none'}
        >{Icon.upload} Upload</button>

        {selected.size > 0 && (
          <button
            onClick={() => {
              selected.forEach(id => documentsAPI.delete(id).catch(() => { }))
              setTimeout(() => { qc.invalidateQueries({ queryKey: ['documents'] }); setSelected(new Set()); toast.success(`${selected.size} documents deleted`) }, 500)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius,8px)', border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', color: '#dc2626', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >{Icon.trash} Delete ({selected.size})</button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text4)', fontSize: 13, gap: 10 }}>
            <div style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Loading documents…
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg,12px)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={TH}>
                    <input type="checkbox" checked={allSelected}
                      onChange={e => setSelected(e.target.checked ? new Set(filtered.map(d => d.id)) : new Set())}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  </th>
                  <th style={TH}>File Name</th>
                  <th style={TH}>Uploaded On</th>
                  <th style={TH}>Status</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, idx) => {
                  const isDeleting = deletingName === doc.name
                  const isDownloading = downloadingName === doc.name
                  return (
                    <tr key={doc.id}
                      style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', opacity: isDeleting ? 0.4 : 1, transition: 'opacity 0.2s' }}
                      onMouseEnter={e => { if (!isDeleting) Array.from(e.currentTarget.cells).forEach(c => c.style.background = 'var(--accent-soft)') }}
                      onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(c => c.style.background = '') }}
                    >
                      <td style={TD}>
                        <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggleSelect(doc.id)}
                          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                      </td>

                      <td style={TD}>
                        <button onClick={() => handleView(doc)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                          onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.target.style.textDecoration = 'none'}
                        >{doc.name}</button>
                      </td>

                      <td style={{ ...TD, color: 'var(--text3)', fontFamily: 'monospace', fontSize: 12 }}>{doc.uploadDate}</td>
                      <td style={TD}><StatusBadge status={doc.status} /></td>

                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center' }}>
                          <ActionBtn onClick={() => handleView(doc)} icon={Icon.eye} label="View" variant="default" />
                          {doc.status === 'Completed' && (
                            <ActionBtn onClick={() => openChat(doc)} icon={Icon.chat} label="Chat" variant="primary" />
                          )}
                          {doc.status === 'Failed' && (
                            <ActionBtn onClick={() => toast.success(`Re-indexing ${doc.name}…`)} icon={Icon.reindex} label="Re-index" variant="warn" />
                          )}
                          <ActionBtn onClick={() => handleDownload(doc)} icon={Icon.download} label="Download" variant="success" loading={isDownloading} />
                          <ActionBtn onClick={() => setDeleteTarget(doc)} icon={Icon.trash} label="Delete" variant="danger" loading={isDeleting} />
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>
                      {search ? 'No documents match your search' : 'No documents uploaded yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)' }}>
              <span style={{ fontSize: 12, color: 'var(--text4)' }}>
                {filtered.length} document{filtered.length !== 1 ? 's' : ''}{selected.size > 0 ? ` · ${selected.size} selected` : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {viewingDoc && <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />}

      {deleteTarget && (
        <DeleteModal
          doc={deleteTarget}
          loading={!!deletingName}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const TH = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text4)', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const TD = { padding: '10px 14px', color: 'var(--text2)', verticalAlign: 'middle', lineHeight: 1.4 }
