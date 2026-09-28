import { useState } from 'react'
import { useUIStore } from '../../store'

export default function RefModal() {
  const { refModalData, closeRefModal } = useUIStore()
  const [openIdx, setOpenIdx]           = useState(refModalData?.activeIndex ?? 0)

  if (!refModalData) return null
  const { sources = [] } = refModalData

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && closeRefModal()}>
      <div className="bg-surface border border-white/10 rounded-2xl w-[500px] max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-surface z-10">
          <h2 className="font-display font-bold text-base">📄 Reference Details</h2>
          <button onClick={closeRefModal} className="w-7 h-7 rounded-md bg-surface2 border border-white/10 flex items-center justify-center text-xs text-white/40 hover:bg-surface3 transition">✕</button>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {sources.map((src, i) => (
            <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
              {/* Toggle header */}
              <button
                onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface2 hover:bg-surface3 transition text-sm font-medium">
                <span className={openIdx === i ? 'text-accent' : 'text-white/60'}>REFERENCE : #{i + 1}</span>
                <span className="text-white/30 text-xs">{openIdx === i ? '▲' : '▾'}</span>
              </button>

              {openIdx === i && (
                <div className="px-4 py-4 border-t border-white/5 animate-slide-down">
                  <div className="font-semibold text-sm mb-3 text-white">{src.docName}</div>

                  {/* Highlighted content */}
                  <div className="bg-accent/8 border-l-4 border-accent rounded-r-lg px-4 py-3 mb-4 italic text-sm text-white/60 leading-relaxed">
                    "{src.content}"
                  </div>

                  {/* Metadata */}
                  <div className="flex gap-4 flex-wrap mb-3">
                    <span className="text-xs font-mono text-white/30">📑 Section: {src.sectionNumber || '—'}</span>
                    <span className="text-xs font-mono text-white/30">📄 Page: {src.pageNumber || '—'}</span>
                    <span className="text-xs font-mono text-white/30">🔢 Tokens: {src.tokenCount}</span>
                  </div>

                  {/* Confidence */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/40">Confidence Score:</span>
                    <div className="flex-1 h-1.5 bg-surface2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-green-400 transition-all"
                           style={{ width: (src.confidenceScore * 100) + '%' }} />
                    </div>
                    <span className="text-xs font-semibold font-mono text-green-400">{src.confidenceScore}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
