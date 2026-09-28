import { useState } from 'react'
import { useUIStore, useChatStore, useAuthStore } from '../store'
import { useDocuments } from '../hooks'
import { documentsAPI } from "../services/api"

export default function Dashboard() {
  const { user } = useAuthStore()
  const { setPanel, openUploadModal } = useUIStore()
  const { setActiveDocument } = useChatStore()
  const { data: docs = [] } = useDocuments()
  const [ddOpen, setDdOpen] = useState(false)

  // const openChat = async (doc) => {

  //   await documentsAPI.ingest(doc.name)

  //   setActiveDocument(doc)

  //   setPanel('chat')
  // }

  const openChat = (doc) => {
    setActiveDocument(doc)
    setPanel('chat')
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-8"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(79,142,247,0.06) 0%, transparent 60%)' }}>

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3 animate-float">🤖</div>
        <h1 className="font-display text-xl ">Welcome, {user?.name || 'User'}</h1>
        <p className="text-sm text-white/40 mt-1">Hi! I am Simpana Global Risk Management AI Assistant.</p>
        <p className="text-xs text-white/30 mt-1">Please upload or select a document to ask your queries.</p>
        <button className="mt-3 border border-white/10 rounded-md px-4 py-1.5 text-xs text-accent hover:bg-accent/10 transition">
          👁 Learn More
        </button>
      </div>

      {/* File Selector */}
      <div className="w-full max-w-lg bg-surface border border-white/10 rounded-xl p-5 mb-6 shadow-xl">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <label className="block text-xs text-white/40 mb-1.5">Select a file</label>
            <div className="relative">
              <button
                onClick={() => setDdOpen(!ddOpen)}
                className="w-full bg-surface2 border border-white/10 rounded-md px-3 py-2 text-sm text-white/40 flex items-center justify-between hover:border-accent/50 transition">
                <span>Select a file...</span><span className="text-xs">▾</span>
              </button>
              {ddOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-surface2 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-white/5">
                    <input className="w-full bg-surface3 border border-white/10 rounded px-2 py-1 text-xs outline-none text-white/60" placeholder="🔍 Search..." />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {docs.filter(d => d.status === 'Completed').map(d => (
                      <div key={d.id}
                        onClick={() => { openChat(d); setDdOpen(false) }}
                        className="px-3 py-2 text-sm text-white/60 hover:bg-surface3 hover:text-white cursor-pointer flex items-center gap-2 border-b border-white/5 last:border-0">
                        📄 {d.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <span className="text-xs text-white/20 pb-2">OR</span>
          <div className="flex-1">
            <label className="block text-xs text-white/40 mb-1.5">Upload a file</label>
            <button onClick={openUploadModal}
              className="w-full bg-accent hover:bg-accent2 text-white text-sm font-semibold py-2 rounded-md transition"
              style={{ boxShadow: '0 4px 16px rgba(79,142,247,0.25)' }}>
              ＋ Upload a file
            </button>
          </div>
        </div>
        <p className="text-xs text-white/20 mt-3 text-center">📋 PDF / DOCX / TXT / XLSX / ZIP · Max 20 MB</p>
      </div>

      {/* Recent Docs + Chats */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-4">
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">📄 Recent Documents</div>
          {docs.slice(0, 4).map(d => (
            <div key={d.id} onClick={() => openChat(d)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface2 transition text-sm text-white/50 hover:text-white">
              📄 <span className="flex-1 truncate text-xs">{d.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${d.status === 'Completed' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {d.status}
              </span>
            </div>
          ))}
        </div>
        <div className="bg-surface border border-white/5 rounded-xl p-4">
          <div className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">💬 Recent Chats</div>
          {['Project timeline queries', 'Contract SLA review', 'Security policy', 'Payment milestones'].map(c => (
            <div key={c} onClick={() => setPanel('history')}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface2 transition text-xs text-white/50 hover:text-white">
              💬 {c}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
