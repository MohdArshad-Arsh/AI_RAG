import { useState } from 'react'
import { useChatSessions, useLoadSession, useDeleteSession } from '../../hooks'
import { useUIStore } from '../../store'
import toast from 'react-hot-toast'

export default function HistoryPanel() {
  const { data: sessions = [], isLoading } = useChatSessions()
  const { setPanel } = useUIStore()
  const loadSession = useLoadSession()
  const deleteSession = useDeleteSession()
  const [search, setSearch] = useState('')

  const now = Date.now()
  const filtered = sessions.filter(s =>
    (s.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.documentName || '').toLowerCase().includes(search.toLowerCase())
  )

  const today = filtered.filter(s => new Date(s.createdAt) > new Date(now - 86400000))
  const yesterday = filtered.filter(s => {
    const d = new Date(s.createdAt)
    return d <= new Date(now - 86400000) && d > new Date(now - 2 * 86400000)
  })
  const older = filtered.filter(s => new Date(s.createdAt) <= new Date(now - 2 * 86400000))

  const handleLoad = async (session) => {
    await loadSession(session)
    setPanel('chat')
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    deleteSession.mutate(id)
  }

  const SessionItem = ({ s }) => (
    <div
      onClick={() => handleLoad(s)}
      className="group flex items-center gap-2 px-4 py-2.5 border-b border-white/5 cursor-pointer hover:bg-surface2 transition"
    >
      <span className="text-base flex-shrink-0">💬</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/70 truncate group-hover:text-white">
          {s.title || 'Untitled chat'}
        </div>
        <div className="text-xs text-white/25 font-mono truncate mt-0.5">
          {s.documentName}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-xs font-mono text-white/20">
          {new Date(s.createdAt).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => handleDelete(e, s.session_id || s.id)}
          className="text-xs text-red-400/40 hover:text-red-400 transition hidden group-hover:block"
        >
          Delete
        </button>
      </div>
    </div>
  )

  const Group = ({ label, items }) =>
    items.length === 0 ? null : (
      <>
        <div className="px-4 py-2 text-xs font-semibold text-white/25 uppercase tracking-wider">
          {label}
        </div>
        {items.map(s => <SessionItem key={s.session_id || s.id} s={s} />)}
      </>
    )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface flex-shrink-0">
        <h1 className="font-display text-lg  flex-1">💬 Chat History</h1>
        <button
          onClick={() => setPanel('chat')}
          className="px-3 py-1.5 text-xs bg-accent text-white font-semibold rounded-md hover:bg-accent2 transition"
        >
          + New Chat
        </button>
      </div>

      <div className="px-4 py-2 border-b border-white/5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface2 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white/60 outline-none focus:border-accent transition"
          placeholder="Search chats..."
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-white/30">Loading history...</div>
        ) : (
          <>
            <Group label="Today" items={today} />
            <Group label="Yesterday" items={yesterday} />
            <Group label="Older" items={older} />
            {filtered.length === 0 && (
              <div className="text-center py-12 text-white/20 text-sm">
                No chat history yet
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}