import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '../../store'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import api from '../../services/api'

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/zip': ['.zip'],
}

// Phase labels shown to user
const PHASE_LABEL = {
  idle: '',
  uploading: 'Uploading...',
  indexing: '⚙ Indexing document...',
  done: '✓ Ready to chat!',
  error: '✗ Failed',
}

export default function UploadModal() {
  const { closeUploadModal } = useUIStore()
  const qc = useQueryClient()
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('idle')   // idle | uploading | indexing | done | error
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const onDrop = useCallback(async (files) => {
    if (files.length === 0) { toast.error('Unsupported file type'); return }
    const file = files[0]
    if (file.size > 20 * 1024 * 1024) { toast.error('File too large. Max 20 MB.'); return }

    setFileName(file.name)
    setPhase('uploading')
    setProgress(0)
    setErrorMsg('')

    try {
      // ── Step 1: Upload file ──────────────────────────────────
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / e.total)
          setProgress(pct)
        },
      })

      const uploadedFilename = uploadRes.data.filename

      // ── Step 2: Ingest (indexing) ────────────────────────────
      // Switch to indexing phase — progress bar resets to show activity
      setPhase('indexing')
      setProgress(0)

      // Animate progress bar during indexing (we don't get real progress from server)
      const iv = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) { clearInterval(iv); return prev }
          return prev + Math.round(3 + Math.random() * 4)
        })
      }, 300)

      try {
        await api.post(`/documents/ingest/${encodeURIComponent(uploadedFilename)}`)
      } finally {
        clearInterval(iv)
      }

      // ── Step 3: Done ─────────────────────────────────────────
      setProgress(100)
      setPhase('done')
      await qc.invalidateQueries({ queryKey: ['documents'] })

    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Upload failed'
      setErrorMsg(msg)
      setPhase('error')
      await qc.invalidateQueries({ queryKey: ['documents'] })
      toast.error(msg)
    }
  }, [qc])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: false,
  })

  const handleClose = () => {
    // Only allow closing after done/error, or from idle
    if (phase === 'uploading' || phase === 'indexing') return
    closeUploadModal()
  }

  const resetAndClose = () => closeUploadModal()

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-surface border border-white/10 rounded-2xl w-[420px] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="font-display font-bold text-base">📤 Upload Document</h2>
          <button
            onClick={handleClose}
            disabled={phase === 'uploading' || phase === 'indexing'}
            className="w-7 h-7 rounded-md bg-surface2 border border-white/10 flex items-center justify-center text-xs text-white/40 hover:bg-surface3 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >✕</button>
        </div>

        {/* Drop Zone — only shown when idle */}
        {phase === 'idle' && (
          <div
            {...getRootProps()}
            className={clsx(
              'm-5 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition',
              isDragActive
                ? 'border-accent bg-accent/10'
                : 'border-white/15 hover:border-accent/50 hover:bg-accent/5'
            )}
          >
            <input {...getInputProps()} />
            <div className="text-4xl mb-3">☁️</div>
            <div className="font-semibold text-sm mb-1">Drag & Drop File Here</div>
            <div className="text-xs text-white/40 mb-3">or click to browse</div>
            <div className="flex justify-center gap-2 flex-wrap">
              {['PDF', 'DOCX', 'TXT', 'XLSX', 'ZIP'].map(f => (
                <span key={f} className="bg-surface2 border border-white/10 rounded px-2 py-0.5 text-xs font-mono text-white/40">{f}</span>
              ))}
            </div>
            <div className="text-xs text-white/20 mt-3">Max file size: 20 MB</div>
          </div>
        )}

        {/* Progress Area — uploading / indexing / done / error */}
        {phase !== 'idle' && (
          <div className="mx-5 my-4">
            <div className="flex items-center gap-3 bg-surface2 border border-white/10 rounded-xl p-4 mb-4">
              <div className="text-2xl">
                {phase === 'error' ? '❌' : phase === 'done' ? '✅' : '📄'}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium truncate">{fileName}</div>
                <div className={clsx(
                  'text-xs mt-0.5',
                  phase === 'error' ? 'text-red-400' : phase === 'done' ? 'text-green-400' : 'text-white/30'
                )}>
                  {phase === 'error' ? errorMsg : PHASE_LABEL[phase]}
                </div>
              </div>
              {phase === 'done' && <span className="text-green-400 text-xl">✅</span>}
              {phase === 'error' && <span className="text-red-400 text-xl">❌</span>}
            </div>

            {/* Progress Bar */}
            {phase !== 'error' && (
              <div className="mb-2">
                <div className="flex justify-between text-xs text-white/40 mb-1">
                  <span>
                    {phase === 'uploading' ? 'Uploading...'
                      : phase === 'indexing' ? 'Indexing...'
                        : 'Complete'}
                  </span>
                  <span>{phase === 'done' ? '100%' : `${Math.min(progress, 99)}%`}</span>
                </div>
                <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${phase === 'done' ? 100 : Math.min(progress, 99)}%`,
                      background: 'linear-gradient(90deg,#4F8EF7,#A78BFA)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step indicators */}
            <div className="flex items-center gap-2 mt-3">
              {/* Step 1 */}
              <div className={clsx(
                'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border',
                phase === 'uploading'
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : 'border-white/10 bg-surface2 text-green-400'
              )}>
                {phase === 'uploading'
                  ? <span className="w-2.5 h-2.5 rounded-full border border-accent border-t-transparent animate-spin" />
                  : '✓'}
                Upload
              </div>

              <div className="flex-1 h-px bg-white/10" />

              {/* Step 2 */}
              <div className={clsx(
                'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border',
                phase === 'indexing'
                  ? 'border-accent/50 bg-accent/10 text-accent'
                  : phase === 'done'
                    ? 'border-white/10 bg-surface2 text-green-400'
                    : 'border-white/10 bg-surface2 text-white/20'
              )}>
                {phase === 'indexing'
                  ? <span className="w-2.5 h-2.5 rounded-full border border-accent border-t-transparent animate-spin" />
                  : phase === 'done' ? '✓' : '○'}
                Index
              </div>

              <div className="flex-1 h-px bg-white/10" />

              {/* Step 3 */}
              <div className={clsx(
                'flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border',
                phase === 'done'
                  ? 'border-green-400/40 bg-green-400/10 text-green-400'
                  : 'border-white/10 bg-surface2 text-white/20'
              )}>
                {phase === 'done' ? '✓' : '○'}
                Ready
              </div>
            </div>
          </div>
        )}

        {/* Footer Button */}
        <div className="px-5 pb-5">
          {phase === 'idle' && (
            <button
              {...getRootProps()}
              className="w-full py-2.5 bg-accent text-white font-semibold text-sm rounded-lg hover:bg-accent2 transition"
            >
              Upload
            </button>
          )}

          {(phase === 'uploading' || phase === 'indexing') && (
            <button
              disabled
              className="w-full py-2.5 bg-surface2 border border-white/10 text-white/30 font-semibold text-sm rounded-lg cursor-not-allowed"
            >
              {phase === 'uploading' ? '⏳ Uploading...' : '⚙ Indexing, please wait...'}
            </button>
          )}

          {phase === 'done' && (
            <button
              onClick={resetAndClose}
              className="w-full py-2.5 bg-green-500 text-white font-semibold text-sm rounded-lg hover:bg-green-600 transition"
            >
              ✓ Done — Start Chatting
            </button>
          )}

          {phase === 'error' && (
            <div className="flex gap-2">
              <button
                onClick={() => setPhase('idle')}
                className="flex-1 py-2.5 bg-surface2 border border-white/10 text-white/60 font-semibold text-sm rounded-lg hover:bg-surface3 transition"
              >
                Try Again
              </button>
              <button
                onClick={resetAndClose}
                className="flex-1 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-sm rounded-lg hover:bg-red-500/30 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
