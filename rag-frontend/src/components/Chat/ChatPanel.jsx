import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useChatStore, useUIStore } from '../../store'
import { useDocuments, useChat, useToggleFavourite, useFavourites, useLoadSession } from '../../hooks'
import api from '../../services/api'

// ─── Questions Panel ──────────────────────────────────────────
function QuestionsPanel({ activeDocument, sendMessage }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.get('/questions')
      .then(res => {
        setQuestions(Array.isArray(res.data.questions) ? res.data.questions : [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.response?.data?.detail || err.message || 'Failed to fetch questions')
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="px-3 py-4 text-xs text-white/30">Loading...</div>
  if (error) return <div className="px-3 py-4 text-xs text-red-400">{error}</div>
  if (!questions.length) return <div className="px-3 py-4 text-xs text-white/30">No questions yet.</div>

  return (
    <div>
      {questions.map((q, i) => (
        <div key={i} className="flex items-start justify-between gap-2 px-3 py-2.5 border-b border-white/5 hover:bg-surface2 transition">
          <span className="text-xs text-white/50 leading-relaxed flex-1">{q}</span>
          <button
            onClick={() => {
              if (!activeDocument) { alert('Select a document first'); return }
              sendMessage(q)
            }}
            className="bg-accent/10 border border-accent/30 rounded px-2 py-1 text-xs text-accent hover:bg-accent/20 transition flex-shrink-0"
          >
            Ask
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Favourites Panel ─────────────────────────────────────────
function FavouritesPanel() {
  const { data: favs = [], isLoading } = useFavourites()
  const { setPanel } = useUIStore()
  const loadSession = useLoadSession()

  const handleOpen = async (fav) => {
    await loadSession({ session_id: fav.session_id, documentName: fav.documentName })
    setPanel('chat')
  }

  if (isLoading) return <div className="px-3 py-4 text-xs text-white/30">Loading...</div>
  if (!favs.length) return (
    <div className="p-6 text-center text-xs text-white/30">
      No favourites yet.<br />Click ☆ on any answer to save it.
    </div>
  )

  return (
    <div>
      {favs.map(f => (
        <div
          key={f.id}
          onClick={() => handleOpen(f)}
          className="px-3 py-3 border-b border-white/5 hover:bg-surface2 transition cursor-pointer"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-yellow-400 text-xs">⭐</span>
            <span className="text-xs font-mono text-white/30 truncate">{f.documentName}</span>
          </div>
          <div className="text-xs text-white/60 leading-relaxed line-clamp-3">{f.content}</div>
          <div className="text-xs text-white/20 font-mono mt-1">
            {f.createdAt ? new Date(f.createdAt).toLocaleString() : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Markdown renderer ────────────────────────────────────────
function RenderAnswer({ text }) {
  return (
    <div className="text-sm leading-relaxed text-white/80 space-y-1">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return null
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4)
          return <p key={i} className="font-bold text-white">{line.slice(2, -2)}</p>
        if (line.startsWith('- '))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-accent mt-0.5 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
            </div>
          )
        if (/^\d+\./.test(line))
          return <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
        if (line.startsWith('# ')) return <h2 key={i} className="font-bold text-base text-white mt-2">{line.slice(2)}</h2>
        if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-sm text-white mt-2">{line.slice(3)}</h3>
        return <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
      })}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────
function Message({ msg }) {
  const { openRefModal } = useUIStore()
  const toggleFav = useToggleFavourite()

  // Non-answers that should not be favouritable
  const ERROR_PHRASES = [
    'please ask a question',
    'does not contain information',
    'could not find',
    'ollama error',
    'no relevant documents',
  ]
  const isErrorResponse = msg.role === 'assistant' &&
    ERROR_PHRASES.some(p => msg.content?.toLowerCase().includes(p))

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end gap-2 items-start animate-fade-up">
        <div>
          <div className="bg-accent2 text-white rounded-xl rounded-tr-sm px-4 py-2.5 max-w-xl text-sm leading-relaxed">
            {msg.content}
          </div>
          <div className="text-right mt-1">
            <span className="text-xs font-mono text-white/20">{new Date(msg.createdAt).toLocaleTimeString()}</span>
          </div>
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
          style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)' }}>G</div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start animate-fade-up">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)', boxShadow: '0 2px 8px rgba(79,142,247,0.3)' }}>
        🤖
      </div>
      <div className="flex-1 max-w-3xl">
        <div className="bg-surface border border-white/10 rounded-xl rounded-tl-sm px-4 py-3 shadow-xl">
          <RenderAnswer text={msg.content} />

          {/* Source & Confidence row */}
          <div className="mt-3 flex items-center gap-4 flex-wrap border-t border-white/5 pt-2">

          </div>

          {/* Action buttons */}
          <div className="mt-2 flex gap-1 flex-wrap">
          {msg.sources?.[0] && (
              <>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30">Source:</span>
                  <button
                    onClick={() => openRefModal({ sources: msg.sources, activeIndex: 0 })}
                    className="bg-surface2 border border-white/10 rounded px-2 py-0.5 text-xs text-accent hover:bg-accent/10 transition font-mono"
                  >
                    📄 {msg.sources[0].docName}
                  </button>
                </div>
              </>
            )}

            {msg.sources?.[0]?.confidenceScore !== undefined && (
              <span className="text-xs font-mono text-white/25">
                    Confidence: {Math.round(msg.sources[0].confidenceScore * 100)}%
              </span>
            )}

            <button
              onClick={() => toggleFav(msg, !msg.isFavourite)}
              className={clsx(
                'px-2 py-1 rounded border text-xs transition',
                msg.isFavourite
                  ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
                  : 'text-white/30 border-white/10 hover:bg-surface2',
                isErrorResponse && 'hidden'
              )}
            >
              {msg.isFavourite ? '⭐ Saved' : '☆ Favourite'}
            </button>

            <button
              onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copied to clipboard') }}
              className="px-2 py-1 rounded border border-white/10 text-xs text-white/30 hover:bg-surface2 transition"
            >
              📋 Copy
            </button>

          </div>
        </div>
        <div className="mt-1">
          <span className="text-xs font-mono text-white/20">{new Date(msg.createdAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main ChatPanel ───────────────────────────────────────────
export default function ChatPanel() {
  const {
    messages, isTyping, activeDocument, setActiveDocument,
    chatSessionId,
    rightPanelOpen, toggleRightPanel,
    activeTab, setActiveTab,
    clearMessages,
  } = useChatStore()

  const { setPanel, openUploadModal } = useUIStore()
  const { data: docs = [] } = useDocuments()
  const { sendMessage } = useChat()

  const [text, setText] = useState('')
  const [docDdOpen, setDocDdOpen] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const pending = sessionStorage.getItem('pendingPrompt')
    if (pending) { sessionStorage.removeItem('pendingPrompt'); setText(pending) }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = () => {
    if (!text.trim() || isTyping) return
    if (!activeDocument) { alert('Please select a document first'); return }
    sendMessage(text.trim())
    setText('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleNewChat = () => { clearMessages(); setPanel('chat') }

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Chat Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="h-11 bg-surface border-b border-white/5 flex items-center gap-2 px-3 flex-shrink-0 flex-wrap">

          <button onClick={handleNewChat}
            className="flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-md px-2.5 py-1 text-xs text-accent hover:bg-accent/20 transition">
            ✏️ New Chat
          </button>

          {/* Session badge */}
          {chatSessionId && (
            <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 rounded px-2 py-0.5">
              <span className="text-xs font-mono text-purple-400">
                Session: {chatSessionId.slice(0, 8)}...
              </span>
            </div>
          )}

          <div className="flex-1" />

          {/* Document Selector */}
          <div className="relative">
            <button
              onClick={() => setDocDdOpen(!docDdOpen)}
              className="flex items-center gap-1.5 bg-surface2 border border-white/10 rounded-md px-2 py-1 text-xs text-white hover:border-accent/50 transition max-w-[200px]"
            >
              📄
              <span className="truncate">{activeDocument?.name || 'Select Document...'}</span>
              <span className="text-white/30 flex-shrink-0">▾</span>
            </button>

            {docDdOpen && (
              <div className="absolute top-full mt-1 right-0 bg-surface2 border border-white/10 rounded-lg shadow-xl z-50 w-64 overflow-hidden">
                {docs.filter(d => d.status === 'Completed').map(d => (
                  <div key={d.id}
                    onClick={() => { setActiveDocument(d); setDocDdOpen(false) }}
                    className="px-3 py-2 text-xs text-white/60 hover:bg-surface3 hover:text-white cursor-pointer border-b border-white/5 last:border-0 flex items-center gap-2"
                  >
                    📄 <span className="truncate">{d.name}</span>
                  </div>
                ))}
                <div
                  onClick={() => { openUploadModal(); setDocDdOpen(false) }}
                  className="px-3 py-2 text-xs text-accent hover:bg-accent/10 cursor-pointer flex items-center gap-2 border-t border-white/10"
                >
                  + Upload new document
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleRightPanel}
            className="flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-md px-2.5 py-1 text-xs text-accent hover:bg-accent/20 transition">
            ≡ Questions
          </button>
        </div>

        {/* Messages or Empty State */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="text-5xl mb-3">🤖</div>
            <h2 className="font-display text-xl ">Welcome, How May I help You?</h2>
            <p className="text-sm text-white/40 mt-2">
              {activeDocument
                ? `Ready to answer questions about ${activeDocument.name}`
                : 'Select a document above and ask your question below'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
            <div className="text-center text-xs font-mono text-white/20 py-1">
              {new Date().toLocaleString()}
            </div>
            {messages.map(msg => <Message key={msg.id} msg={msg} />)}
            {isTyping && (
              <div className="flex gap-2 items-start">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#4F8EF7,#A78BFA)' }}>🤖</div>
                <div className="bg-surface border border-white/10 rounded-xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        <div className="bg-surface border-t border-white/5 p-3 flex-shrink-0">
          <div className={clsx('bg-surface2 border rounded-xl flex items-end gap-2 px-4 py-2 transition',
            text ? 'border-accent/50' : 'border-white/10')}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              placeholder="Ask your Question"
              className="flex-1 bg-transparent text-sm text-white outline-none resize-none min-h-5 max-h-28 leading-relaxed placeholder:text-white/25 chat-textarea"
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px'
              }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || isTyping}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-white transition flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: text.trim() ? 'var(--accent)' : '#cbd3d8' }}
            >➤</button>
          </div>
          <div className="flex justify-between mt-1 text-xs font-mono text-white/20">
            <span>{activeDocument ? `📄 ${activeDocument.name}` : 'No document selected'}</span>
            <span>{text.length} / 4000</span>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      {rightPanelOpen && (
        <div className="w-72 border-l border-white/5 bg-surface flex flex-col overflow-hidden flex-shrink-0">
          <div className="flex border-b border-white/5 flex-shrink-0">
            {['questions', 'favourites'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={clsx('flex-1 py-2.5 text-xs font-medium transition border-b-2 -mb-px',
                  activeTab === tab
                    ? 'text-accent border-accent'
                    : 'text-white/30 border-transparent hover:text-white/50')}>
                {tab === 'questions' ? 'Questions' : '⭐ Favourites'}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto flex-1">
            {activeTab === 'questions' && (
              <QuestionsPanel activeDocument={activeDocument} sendMessage={sendMessage} />
            )}
            {activeTab === 'favourites' && <FavouritesPanel />}
          </div>
        </div>
      )}
    </div>
  )
}
