import { useState, useEffect, useRef } from 'react'
import { documentsAPI } from '../../services/api'
import toast from 'react-hot-toast'

// ── Icons ─────────────────────────────────────────────────────
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)
const ZoomInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
  </svg>
)
const ZoomOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
)
const FullscreenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────
function getFileType(filename = '') {
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'txt') return 'txt'
  if (ext === 'docx') return 'docx'
  if (ext === 'xlsx' || ext === 'xls') return 'excel'
  if (ext === 'pptx') return 'pptx'
  if (ext === 'zip') return 'zip'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  return 'other'
}

function getMimeType(filename = '') {
  const ext = filename.split('.').pop().toLowerCase()
  const map = {
    pdf: 'application/pdf',
    txt: 'text/plain',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  }
  return map[ext] || 'application/octet-stream'
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ── Loading Spinner ───────────────────────────────────────────
function Spinner({ text = 'Loading document…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: '100%', color: 'var(--text3)' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: 13 }}>{text}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Error State ───────────────────────────────────────────────
function ErrorState({ message, filename, onDownload }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, height: '100%', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 52 }}>⚠️</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Cannot display this file</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 360, lineHeight: 1.6 }}>{message}</div>
      <button onClick={onDownload} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
        <DownloadIcon /> Download file instead
      </button>
    </div>
  )
}

// ── PDF Viewer ────────────────────────────────────────────────
function PdfViewer({ blobUrl, filename }) {
  return (
    <iframe
      src={blobUrl}
      title={filename}
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  )
}

// ── Text Viewer ───────────────────────────────────────────────
function TextViewer({ content }) {
  const [fontSize, setFontSize] = useState(14)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface2)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text4)', marginRight: 4 }}>Font size:</span>
        <button onClick={() => setFontSize(s => Math.max(10, s - 2))} style={toolBtn}><ZoomOutIcon /></button>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text3)', minWidth: 28, textAlign: 'center' }}>{fontSize}px</span>
        <button onClick={() => setFontSize(s => Math.min(24, s + 2))} style={toolBtn}><ZoomInIcon /></button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg)' }}>
        <pre style={{ fontFamily: 'JetBrains Mono, IBM Plex Mono, monospace', fontSize: fontSize, color: 'var(--text2)', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
          {content}
        </pre>
      </div>
    </div>
  )
}

// ── Image Viewer ──────────────────────────────────────────────
function ImageViewer({ blobUrl, filename }) {
  const [zoom, setZoom] = useState(1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface2)', flexShrink: 0 }}>
        <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} style={toolBtn}><ZoomOutIcon /></button>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text3)', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} style={toolBtn}><ZoomInIcon /></button>
        <button onClick={() => setZoom(1)} style={{ ...toolBtn, fontSize: 11, padding: '3px 8px', width: 'auto' }}>Reset</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
        <img src={blobUrl} alt={filename}
          style={{ maxWidth: `${zoom * 100}%`, height: 'auto', borderRadius: 8, boxShadow: 'var(--shadow-md)', display: 'block' }} />
      </div>
    </div>
  )
}

// ── Excel Viewer (SheetJS) ────────────────────────────────────
function ExcelViewer({ arrayBuffer, filename, onDownload }) {
  const [sheets, setSheets] = useState([])
  const [activeSheet, setActive] = useState(0)
  const [tableData, setTableData] = useState({ headers: [], rows: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const loadExcel = async () => {
      try {
        // Dynamically import SheetJS
        const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
        const wb = XLSX.read(arrayBuffer, { type: 'array' })
        if (cancelled) return

        const sheetNames = wb.SheetNames
        setSheets(sheetNames)

        const parseSheet = (name) => {
          const ws = wb.Sheets[name]
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          if (!json.length) return { headers: [], rows: [] }
          const headers = json[0].map(String)
          const rows = json.slice(1)
          return { headers, rows }
        }

        setTableData(parseSheet(sheetNames[0]))
        setLoading(false)

        // Store wb ref for sheet switching
        window.__xlsxWb = wb
        window.__xlsxLib = XLSX
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setLoading(false)
        }
      }
    }
    loadExcel()
    return () => { cancelled = true }
  }, [arrayBuffer])

  const switchSheet = (idx) => {
    setActive(idx)
    if (window.__xlsxWb && window.__xlsxLib) {
      const wb = window.__xlsxWb
      const XLSX = window.__xlsxLib
      const ws = wb.Sheets[wb.SheetNames[idx]]
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (!json.length) { setTableData({ headers: [], rows: [] }); return }
      setTableData({ headers: json[0].map(String), rows: json.slice(1) })
    }
  }

  if (loading) return <Spinner text="Parsing Excel file…" />
  if (error) return (
    <ErrorState
      message={`Could not parse Excel file: ${error}`}
      filename={filename}
      onDownload={onDownload}
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0, overflowX: 'auto' }}>
          {sheets.map((name, i) => (
            <button key={name} onClick={() => switchSheet(i)} style={{
              padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border)',
              background: i === activeSheet ? 'var(--accent)' : 'var(--surface)',
              color: i === activeSheet ? 'white' : 'var(--text3)',
              whiteSpace: 'nowrap',
            }}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        {tableData.rows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text4)', fontSize: 14 }}>
            This sheet is empty
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                {/* Row number col */}
                <th style={thStyle('#', true)}>#</th>
                {tableData.headers.map((h, i) => (
                  <th key={i} style={thStyle(h)}>{h || <span style={{ color: 'var(--text4)' }}>Col {i + 1}</span>}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                  <td style={{ ...tdStyle, color: 'var(--text4)', fontWeight: 500, textAlign: 'center', background: 'var(--surface2)', borderRight: '2px solid var(--border2)', minWidth: 40 }}>
                    {ri + 1}
                  </td>
                  {tableData.headers.map((_, ci) => (
                    <td key={ci} style={tdStyle}>{row[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer info */}
      <div style={{ padding: '6px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>
          📊 {tableData.rows.length} rows × {tableData.headers.length} columns
        </span>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>
          Sheet: {sheets[activeSheet]}
        </span>
      </div>
    </div>
  )
}

const thStyle = (_, isRowNum = false) => ({
  padding: '8px 14px',
  background: 'var(--surface2)',
  color: 'var(--text2)',
  fontWeight: 600,
  fontSize: 12,
  textAlign: isRowNum ? 'center' : 'left',
  borderBottom: '2px solid var(--border2)',
  borderRight: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  minWidth: isRowNum ? 40 : 100,
})

const tdStyle = {
  padding: '7px 14px',
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 13,
  whiteSpace: 'nowrap',
  maxWidth: 300,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

// ── Load JSZip via script tag ─────────────────────────────────
function loadJSZip() {
  return new Promise((resolve, reject) => {
    if (window.JSZip) { resolve(window.JSZip); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
    script.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error('JSZip not found on window'))
    script.onerror = () => reject(new Error('Failed to load JSZip script'))
    document.head.appendChild(script)
  })
}

// ── ZIP Viewer (JSZip) ────────────────────────────────────────
function ZipViewer({ arrayBuffer, filename, onDownload }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name') // name | size | type

  useEffect(() => {
    let cancelled = false
    const loadZip = async () => {
      try {
        const JSZip = await loadJSZip()
        const zip = await JSZip.loadAsync(arrayBuffer)
        if (cancelled) return

        const list = []
        zip.forEach((path, file) => {
          list.push({
            name: path,
            isDir: file.dir,
            size: file._data?.uncompressedSize ?? 0,
            compressedSize: file._data?.compressedSize ?? 0,
            ext: path.split('.').pop().toLowerCase(),
          })
        })
        list.sort((a, b) => a.name.localeCompare(b.name))
        setEntries(list)
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setLoading(false)
        }
      }
    }
    loadZip()
    return () => { cancelled = true }
  }, [arrayBuffer])

  if (loading) return <Spinner text="Reading ZIP contents…" />
  if (error) return (
    <ErrorState message={`Could not read ZIP: ${error}`} filename={filename} onDownload={onDownload} />
  )

  const fileIcon = (entry) => {
    if (entry.isDir) return '📁'
    const ext = entry.ext
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️'
    if (['pdf'].includes(ext)) return '📄'
    if (['doc', 'docx'].includes(ext)) return '📝'
    if (['xls', 'xlsx'].includes(ext)) return '📊'
    if (['ppt', 'pptx'].includes(ext)) return '📑'
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return '🎵'
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return '🎬'
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json'].includes(ext)) return '💻'
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️'
    if (['txt', 'md', 'csv'].includes(ext)) return '📃'
    return '📎'
  }

  const filtered = entries
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'size') return b.size - a.size
      if (sortBy === 'type') return a.ext.localeCompare(b.ext)
      return a.name.localeCompare(b.name)
    })

  const totalFiles = entries.filter(e => !e.isDir).length
  const totalSize = entries.reduce((s, e) => s + e.size, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface2)', flexShrink: 0, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files…"
          style={{ flex: 1, minWidth: 160, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, outline: 'none' }}
        />
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>Sort:</span>
        {['name', 'size', 'type'].map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
            border: '1px solid var(--border)',
            background: sortBy === s ? 'var(--accent)' : 'var(--surface)',
            color: sortBy === s ? 'white' : 'var(--text3)',
          }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text4)', fontSize: 13 }}>No files found</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle(), width: 36 }}></th>
                <th style={thStyle()}>File Name</th>
                <th style={{ ...thStyle(), textAlign: 'right', width: 100 }}>Size</th>
                <th style={{ ...thStyle(), textAlign: 'right', width: 120 }}>Compressed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)'}
                >
                  <td style={{ ...tdStyle, textAlign: 'center', padding: '6px 8px' }}>{fileIcon(entry)}</td>
                  <td style={{ ...tdStyle, fontFamily: entry.isDir ? 'inherit' : 'JetBrains Mono, monospace', color: entry.isDir ? 'var(--accent)' : 'var(--text)', fontWeight: entry.isDir ? 600 : 400, maxWidth: 500 }}>
                    {entry.name}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text3)' }}>
                    {entry.isDir ? '—' : formatBytes(entry.size)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text4)', fontSize: 12 }}>
                    {entry.isDir ? '—' : formatBytes(entry.compressedSize)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>🗜️ {totalFiles} files</span>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>Total uncompressed: {formatBytes(totalSize)}</span>
        {search && <span style={{ fontSize: 11, color: 'var(--accent)' }}>Showing {filtered.length} of {entries.length}</span>}
      </div>
    </div>
  )
}

// ── DOCX Viewer (mammoth.js) ──────────────────────────────────
function loadMammoth() {
  return new Promise((resolve, reject) => {
    if (window.mammoth) { resolve(window.mammoth); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js'
    script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error('mammoth not found'))
    script.onerror = () => reject(new Error('Failed to load mammoth.js'))
    document.head.appendChild(script)
  })
}

function DocxViewer({ arrayBuffer, filename, onDownload }) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [warnings, setWarnings] = useState([])

  useEffect(() => {
    let cancelled = false
    const convert = async () => {
      try {
        const mammoth = await loadMammoth()
        const result = await mammoth.convertToHtml({ arrayBuffer })
        if (cancelled) return
        setHtml(result.value)
        setWarnings(result.messages || [])
        setLoading(false)
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    }
    convert()
    return () => { cancelled = true }
  }, [arrayBuffer])

  if (loading) return <Spinner text="Converting Word document…" />
  if (error) return <ErrorState message={`Could not convert DOCX: ${error}`} filename={filename} onDownload={onDownload} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>📝 Word Document — rendered as HTML</span>
        {warnings.length > 0 && (
          <span style={{ fontSize: 11, color: '#f59e0b' }}>⚠️ {warnings.length} formatting warning(s)</span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={onDownload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 7, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            <DownloadIcon /> Download Original
          </button>
        </div>
      </div>

      {/* Document content */}
      <div style={{ flex: 1, overflow: 'auto', background: 'white', padding: '40px 60px' }}>
        <div
          style={{
            maxWidth: 820,
            margin: '0 auto',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 15,
            lineHeight: 1.8,
            color: '#1a1a1a',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {/* Scoped styles for docx content */}
        <style>{`
          .docx-content h1 { font-size:26px; font-weight:700; margin:28px 0 12px; }
          .docx-content h2 { font-size:21px; font-weight:700; margin:24px 0 10px; }
          .docx-content h3 { font-size:17px; font-weight:700; margin:20px 0 8px; }
          .docx-content p  { margin:0 0 12px; }
          .docx-content table { border-collapse:collapse; width:100%; margin:16px 0; }
          .docx-content td, .docx-content th { border:1px solid #d1d5db; padding:8px 12px; }
          .docx-content th { background:#f3f4f6; font-weight:600; }
          .docx-content ul, .docx-content ol { padding-left:24px; margin:0 0 12px; }
          .docx-content li { margin-bottom:4px; }
          .docx-content strong { font-weight:700; }
          .docx-content em { font-style:italic; }
          .docx-content img { max-width:100%; border-radius:4px; }
        `}</style>
      </div>

      {/* Footer */}
      <div style={{ padding: '6px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text4)' }}>
          💡 Some complex formatting (charts, shapes) may not render perfectly — use Download for exact view
        </span>
      </div>
    </div>
  )
}

// ── Office Viewer (PPTX only now — DOCX handled by DocxViewer) ─
function OfficeViewer({ blobUrl, filename, fileType, onDownload }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: '100%', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 64 }}>📑</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{filename}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 400, lineHeight: 1.7 }}>
        <strong>PowerPoint Presentation</strong> files cannot be rendered directly in the browser.
        <br />Download the file to open it in Microsoft Office or compatible software.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onDownload} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, background: 'var(--accent)', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <DownloadIcon /> Download & Open
        </button>
        <a href={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(blobUrl)}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
          🌐 Open in Office Online
        </a>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>
        Note: "Office Online" requires the file to be publicly accessible
      </div>
    </div>
  )
}

// ── Main Document Viewer ──────────────────────────────────────
export default function DocumentViewer({ doc, onClose }) {
  const [state, setState] = useState('loading')
  const [blobUrl, setBlobUrl] = useState(null)
  const [arrayBuffer, setArrayBuffer] = useState(null)   // for Excel & ZIP
  const [textContent, setTextContent] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef(null)

  const fileType = getFileType(doc.name)
  const mimeType = getMimeType(doc.name)

  // ── Fetch file on mount ─────────────────────────────────────
  useEffect(() => {
    let objectUrl = null

    const fetchDoc = async () => {
      setState('loading')
      try {
        const res = await documentsAPI.download(doc.name)
        const blob = new Blob([res.data], { type: mimeType })
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)

        // For Excel, ZIP and DOCX we need ArrayBuffer
        if (fileType === 'excel' || fileType === 'zip' || fileType === 'docx') {
          const buf = await blob.arrayBuffer()
          setArrayBuffer(buf)
        }

        if (fileType === 'txt') {
          const text = await blob.text()
          setTextContent(text)
        }

        setState('ready')
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || 'Failed to load document'
        setErrorMsg(msg)
        setState('error')
      }
    }

    fetchDoc()
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [doc.name])

  // ── Download handler ────────────────────────────────────────
  const handleDownload = () => {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = doc.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Downloading: ${doc.name}`)
  }

  // ── Toggle fullscreen ───────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  // ── Close on Escape ─────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const typeLabel = {
    pdf: 'PDF', txt: 'Text File', docx: 'Word Document',
    excel: 'Excel Spreadsheet', pptx: 'PowerPoint', image: 'Image',
    zip: 'ZIP Archive', other: 'File',
  }[fileType] || 'File'

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={containerRef} style={{
        width: '100%', maxWidth: 1100, height: '90vh',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'scaleIn 0.2s ease',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-soft)', border: '1px solid var(--accent-soft2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0, fontSize: 18 }}>
            {fileType === 'pdf' && '📄'}
            {fileType === 'txt' && '📃'}
            {fileType === 'docx' && '📝'}
            {fileType === 'excel' && '📊'}
            {fileType === 'pptx' && '📑'}
            {fileType === 'image' && '🖼'}
            {fileType === 'zip' && '🗜️'}
            {fileType === 'other' && '📎'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 1 }}>{typeLabel}</div>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {state === 'ready' && (
              <button onClick={handleDownload} style={headerBtn} title="Download">
                <DownloadIcon />
                <span style={{ fontSize: 12 }}>Download</span>
              </button>
            )}
            <button onClick={toggleFullscreen} style={iconBtn} title="Fullscreen">
              <FullscreenIcon />
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
            <button onClick={onClose} style={iconBtn} title="Close (Esc)">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Viewer body ── */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {state === 'loading' && <Spinner />}

          {state === 'error' && (
            <ErrorState message={errorMsg} filename={doc.name} onDownload={handleDownload} />
          )}

          {state === 'ready' && (
            <>
              {fileType === 'pdf' && (
                <PdfViewer blobUrl={blobUrl} filename={doc.name} />
              )}
              {fileType === 'txt' && (
                <TextViewer content={textContent} />
              )}
              {fileType === 'image' && (
                <ImageViewer blobUrl={blobUrl} filename={doc.name} />
              )}
              {fileType === 'excel' && arrayBuffer && (
                <ExcelViewer
                  arrayBuffer={arrayBuffer}
                  filename={doc.name}
                  onDownload={handleDownload}
                />
              )}
              {fileType === 'zip' && arrayBuffer && (
                <ZipViewer
                  arrayBuffer={arrayBuffer}
                  filename={doc.name}
                  onDownload={handleDownload}
                />
              )}
              {fileType === 'docx' && arrayBuffer && (
                <DocxViewer
                  arrayBuffer={arrayBuffer}
                  filename={doc.name}
                  onDownload={handleDownload}
                />
              )}
              {fileType === 'pptx' && (
                <OfficeViewer
                  blobUrl={blobUrl}
                  filename={doc.name}
                  fileType={fileType}
                  onDownload={handleDownload}
                />
              )}
              {fileType === 'other' && (
                <ErrorState
                  message={`".${doc.name.split('.').pop()}" files cannot be previewed in the browser.`}
                  filename={doc.name}
                  onDownload={handleDownload}
                />
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {state === 'ready' && fileType === 'pdf' && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--text4)' }}>
              💡 Use browser controls to zoom, search (Ctrl+F), or print (Ctrl+P)
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scaleIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────
const toolBtn = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text3)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12, transition: 'all 0.15s',
}

const headerBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border2)',
  background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12,
  fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
}

const iconBtn = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface2)', color: 'var(--text3)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 0.15s',
}