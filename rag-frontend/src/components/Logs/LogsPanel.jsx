import { useState, useEffect } from 'react'
import api from '../../services/api'

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (iso) => iso ? new Date(iso).toLocaleString() : '—'
const ms = (v) => v != null ? `${v} ms` : '—'
const badge = (type) => {
    const map = {
        upload: { bg: 'bg-blue-500/10  text-blue-400  border-blue-500/20', icon: '⬆' },
        ingest: { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: '⚙' },
        chat: { bg: 'bg-green-500/10 text-green-400 border-green-500/20', icon: '💬' },
        download: { bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: '⬇' },
        delete: { bg: 'bg-red-500/10   text-red-400   border-red-500/20', icon: '🗑' },
    }
    const s = map[type] || { bg: 'bg-surface2 text-white/40 border-white/10', icon: '•' }
    return (
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold ${s.bg}`}>
            {s.icon} {type}
        </span>
    )
}
const roleBadge = (role) => (
    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${role === 'admin' ? 'bg-accent/10 text-accent' : 'bg-surface3 text-white/40'
        }`}>{role}</span>
)

// ─── Sub-tabs ──────────────────────────────────────────────────
const TABS = [
    { id: 'activity', label: '📋 Activity Log' },
    { id: 'chats', label: '💬 Chat Sessions' },
    { id: 'docs', label: '📄 Documents' },
    { id: 'users', label: '👥 User Stats' },
]

// ─── Activity Tab ─────────────────────────────────────────────
function ActivityTab({ logs, search }) {
    const filtered = logs.filter(l =>
        !search ||
        l.username?.toLowerCase().includes(search) ||
        l.actionType?.toLowerCase().includes(search) ||
        l.documentName?.toLowerCase().includes(search) ||
        l.questionAsked?.toLowerCase().includes(search)
    )
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
                <thead className="sticky top-0 z-10">
                    <tr>
                        {['#', 'User', 'Role', 'Action', 'Document', 'Question / Detail', 'Response Time', 'Timestamp'].map(h => (
                            <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-white/25 uppercase tracking-wider border-b border-white/5 bg-surface whitespace-nowrap">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filtered.map((l, i) => (
                        <tr key={l.logId} className="border-b border-white/5 hover:bg-surface2/50 transition">
                            <td className="px-3 py-2 text-xs text-white/20 font-mono">{l.logId}</td>
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                        style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)' }}>
                                        {(l.username || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="text-xs text-white/70 font-mono">{l.username || '—'}</span>
                                </div>
                            </td>
                            <td className="px-3 py-2">{roleBadge(l.userRole)}</td>
                            <td className="px-3 py-2">{badge(l.actionType)}</td>
                            <td className="px-3 py-2 text-xs text-white/50 font-mono max-w-[160px] truncate" title={l.documentName}>
                                {l.documentName || '—'}
                            </td>
                            <td className="px-3 py-2 text-xs text-white/50 max-w-[260px]">
                                <span className="line-clamp-2 leading-relaxed">{l.questionAsked || '—'}</span>
                            </td>
                            <td className="px-3 py-2">
                                {l.responseTimeMs != null ? (
                                    <span className={`text-xs font-mono font-semibold ${l.responseTimeMs < 2000 ? 'text-green-400' :
                                            l.responseTimeMs < 5000 ? 'text-yellow-400' : 'text-red-400'
                                        }`}>{ms(l.responseTimeMs)}</span>
                                ) : <span className="text-white/20 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2 text-xs text-white/30 font-mono whitespace-nowrap">{fmt(l.actionTime)}</td>
                        </tr>
                    ))}
                    {filtered.length === 0 && (
                        <tr><td colSpan={8} className="text-center py-10 text-white/20 text-sm">No activity logs found</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

// ─── Chat Sessions Tab ────────────────────────────────────────
function ChatsTab({ sessions, search }) {
    const [openSid, setOpenSid] = useState(null)

    const filtered = sessions.filter(s =>
        !search ||
        s.username?.toLowerCase().includes(search) ||
        s.documentName?.toLowerCase().includes(search) ||
        s.sessionTitle?.toLowerCase().includes(search)
    )

    return (
        <div className="flex flex-col gap-2 p-4">
            {filtered.map(s => (
                <div key={s.sessionId} className="bg-surface border border-white/8 rounded-xl overflow-hidden">
                    {/* Session header */}
                    <button
                        onClick={() => setOpenSid(openSid === s.sessionId ? null : s.sessionId)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface2 transition text-left"
                    >
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)' }}>
                            {(s.username || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white/80 truncate">{s.sessionTitle || 'Untitled'}</div>
                            <div className="text-xs text-white/30 font-mono mt-0.5 truncate">
                                {s.username} · {s.documentName}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs bg-surface2 border border-white/10 rounded px-2 py-0.5 text-white/30">
                                {s.messages.length} msgs
                            </span>
                            <span className="text-white/20 text-xs">{openSid === s.sessionId ? '▲' : '▾'}</span>
                        </div>
                    </button>

                    {/* Messages expand */}
                    {openSid === s.sessionId && (
                        <div className="border-t border-white/5 px-4 py-3 flex flex-col gap-3">
                            {s.messages.map(m => (
                                <div key={m.msgId} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                                    {m.role === 'assistant' && (
                                        <div className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)' }}>🤖</div>
                                    )}
                                    <div className={`max-w-2xl rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user'
                                            ? 'bg-accent/15 text-white/70'
                                            : 'bg-surface2 border border-white/8 text-white/60'
                                        }`}>
                                        <div className="text-white/20 text-xs mb-1 font-mono">
                                            {m.role === 'user' ? '👤 User' : '🤖 AI'} · {fmt(m.createdAt)}
                                            {m.isFavourite && ' · ⭐ Saved'}
                                        </div>
                                        <div className="whitespace-pre-wrap">{m.content}</div>
                                        {m.sources?.length > 0 && (
                                            <div className="mt-1.5 text-white/30 text-xs">
                                                Sources: {m.sources.map(s => s.docName).join(', ')} ·{' '}
                                                Confidence: {Math.round((m.sources[0]?.confidenceScore || 0) * 100)}%
                                            </div>
                                        )}
                                    </div>
                                    {m.role === 'user' && (
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)' }}>
                                            {(s.username || '?')[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {s.messages.length === 0 && (
                                <div className="text-center text-white/20 text-xs py-4">No messages in this session</div>
                            )}
                        </div>
                    )}
                </div>
            ))}
            {filtered.length === 0 && (
                <div className="text-center py-12 text-white/20 text-sm">No chat sessions found</div>
            )}
        </div>
    )
}

// ─── Documents Tab ────────────────────────────────────────────
function DocsTab({ documents, search }) {
    const filtered = documents.filter(d =>
        !search ||
        d.filename?.toLowerCase().includes(search) ||
        d.username?.toLowerCase().includes(search)
    )
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                    <tr>
                        {['#', 'Filename', 'Uploaded By', 'Role', 'Status', 'Uploaded At'].map(h => (
                            <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-white/25 uppercase tracking-wider border-b border-white/5 bg-surface whitespace-nowrap">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filtered.map(d => (
                        <tr key={d.docId} className="border-b border-white/5 hover:bg-surface2/50 transition">
                            <td className="px-3 py-2 text-xs text-white/20 font-mono">{d.docId}</td>
                            <td className="px-3 py-2 text-xs text-white/70 font-mono max-w-[220px] truncate">{d.filename}</td>
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                        style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)' }}>
                                        {(d.username || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="text-xs text-white/60 font-mono">{d.username}</span>
                                </div>
                            </td>
                            <td className="px-3 py-2">{roleBadge(d.userRole)}</td>
                            <td className="px-3 py-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${d.status === 'Completed' ? 'bg-green-500/10 text-green-400' :
                                        d.status === 'Failed' ? 'bg-red-500/10 text-red-400' :
                                            'bg-yellow-500/10 text-yellow-400'
                                    }`}>{d.status}</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-white/30 font-mono">{fmt(d.uploadedAt)}</td>
                        </tr>
                    ))}
                    {filtered.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-10 text-white/20 text-sm">No documents found</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

// ─── User Stats Tab ───────────────────────────────────────────
function UsersTab({ users, search }) {
    const filtered = users.filter(u =>
        !search || u.username?.toLowerCase().includes(search)
    )
    return (
        <div className="p-4 grid grid-cols-1 gap-3">
            {filtered.map(u => (
                <div key={u.userId}
                    className="bg-surface border border-white/8 rounded-xl p-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)' }}>
                        {(u.username || '?')[0].toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{u.username}</span>
                            {roleBadge(u.role)}
                        </div>
                        <div className="text-xs text-white/25 font-mono mt-0.5">
                            Joined {fmt(u.joinedAt)}
                        </div>
                    </div>
                    {/* Stats */}
                    <div className="flex gap-5 flex-shrink-0">
                        {[
                            { label: 'Docs', value: u.totalDocs },
                            { label: 'Sessions', value: u.totalSessions },
                            { label: 'Chats', value: u.totalChats },
                        ].map(s => (
                            <div key={s.label} className="text-center">
                                <div className="text-lg font-bold text-white/80">{s.value ?? 0}</div>
                                <div className="text-xs text-white/25">{s.label}</div>
                            </div>
                        ))}
                        <div className="text-center">
                            <div className={`text-lg font-bold ${u.avgResponseMs == null ? 'text-white/30' :
                                    u.avgResponseMs < 2000 ? 'text-green-400' :
                                        u.avgResponseMs < 5000 ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                {u.avgResponseMs != null ? `${u.avgResponseMs}ms` : '—'}
                            </div>
                            <div className="text-xs text-white/25">Avg response</div>
                        </div>
                    </div>
                </div>
            ))}
            {filtered.length === 0 && (
                <div className="text-center py-12 text-white/20 text-sm">No users found</div>
            )}
        </div>
    )
}

// ─── Main LogsPanel ───────────────────────────────────────────
export default function LogsPanel() {
    const [activeTab, setActiveTab] = useState('activity')
    const [search, setSearch] = useState('')
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastRefresh, setLastRefresh] = useState(null)

    const loadLogs = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await api.get('/admin/logs')
            setData(res.data)
            setLastRefresh(new Date())
        } catch (e) {
            setError(e.response?.data?.detail || e.message || 'Failed to load logs')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadLogs() }, [])

    const q = search.trim().toLowerCase()

    // Summary counts
    const counts = data ? {
        activity: data.activityLogs.length,
        chats: data.chatSessions.length,
        docs: data.documents.length,
        users: data.users.length,
    } : {}

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface flex-shrink-0 flex-wrap">
                <div>
                    <h1 className="font-display text-lg  flex items-center gap-2">
                        📋 Admin Logs
                        <span className="text-xs bg-accent/10 border border-accent/30 text-accent rounded-full px-2 py-0.5 font-normal">
                            Admin only
                        </span>
                    </h1>
                    <p className="text-xs text-white/30 mt-0.5">
                        All users' uploads, chats, response times, and activity
                    </p>
                </div>
                <div className="flex-1" />
                {lastRefresh && (
                    <span className="text-xs font-mono text-white/20">
                        Last refreshed: {lastRefresh.toLocaleTimeString()}
                    </span>
                )}
                <button
                    onClick={loadLogs}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs border border-white/10 bg-surface2 rounded-md text-white/50 hover:bg-surface3 transition disabled:opacity-40"
                >
                    {loading ? '⏳ Loading…' : '🔄 Refresh'}
                </button>
            </div>

            {/* KPI row */}
            {data && !loading && (
                <div className="grid grid-cols-4 gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
                    {[
                        { label: 'Activity Events', value: counts.activity, color: 'text-accent' },
                        { label: 'Chat Sessions', value: counts.chats, color: 'text-purple-400' },
                        { label: 'Documents', value: counts.docs, color: 'text-green-400' },
                        { label: 'Users', value: counts.users, color: 'text-yellow-400' },
                    ].map(s => (
                        <div key={s.label} className="bg-surface2 border border-white/5 rounded-xl px-4 py-3">
                            <div className={`font-display text-2xl  ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-white/30 mt-0.5">{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Search + Tabs */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 flex-shrink-0">
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 text-sm">⌕</span>
                    <input
                        className="bg-surface2 border border-white/10 rounded-md pl-7 pr-3 py-1.5 text-xs text-white/60 outline-none focus:border-accent w-56 transition"
                        placeholder="Filter by user, doc, action…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex border border-white/10 rounded-lg overflow-hidden">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${activeTab === t.id
                                    ? 'bg-accent text-white'
                                    : 'text-white/40 hover:text-white/60 hover:bg-surface2'
                                }`}>
                            {t.label}
                            {data && (
                                <span className="ml-1.5 text-xs opacity-60">
                                    ({counts[t.id] ?? 0})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="flex items-center justify-center h-40 text-white/30 text-sm gap-2">
                        <span className="animate-spin">⏳</span> Loading logs…
                    </div>
                )}
                {error && !loading && (
                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                        <div className="text-red-400 text-sm">⚠ {error}</div>
                        <button onClick={loadLogs}
                            className="px-4 py-2 text-xs bg-accent text-white rounded-lg hover:bg-accent2 transition">
                            Retry
                        </button>
                    </div>
                )}
                {data && !loading && !error && (
                    <>
                        {activeTab === 'activity' && <ActivityTab logs={data.activityLogs} search={q} />}
                        {activeTab === 'chats' && <ChatsTab sessions={data.chatSessions} search={q} />}
                        {activeTab === 'docs' && <DocsTab documents={data.documents} search={q} />}
                        {activeTab === 'users' && <UsersTab users={data.users} search={q} />}
                    </>
                )}
            </div>
        </div>
    )
}