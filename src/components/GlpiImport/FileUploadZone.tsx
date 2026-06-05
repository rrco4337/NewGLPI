import { useRef, useState } from 'react'

type Props = {
  label: string
  hint: string
  icon: string
  accept: string
  file: File | null
  onFile: (f: File | null) => void
}

// Map emoji icons to Bootstrap Icons
const ICON_MAP: Record<string, string> = {
  '📋': 'bi-file-earmark-spreadsheet-fill',
  '🎫': 'bi-ticket-detailed-fill',
  '💰': 'bi-currency-euro',
  '🖼':  'bi-file-zip-fill',
  '🖼️': 'bi-file-zip-fill',
}

const ACCENT_MAP: Record<string, { color: string; bg: string; borderColor: string }> = {
  '📋': { color: '#4f46e5', bg: '#eef2ff', borderColor: '#a5b4fc' },
  '🎫': { color: '#0ea5e9', bg: '#e0f2fe', borderColor: '#7dd3fc' },
  '💰': { color: '#10b981', bg: '#d1fae5', borderColor: '#6ee7b7' },
  '🖼':  { color: '#f59e0b', bg: '#fef3c7', borderColor: '#fcd34d' },
  '🖼️': { color: '#f59e0b', bg: '#fef3c7', borderColor: '#fcd34d' },
}

export const FileUploadZone = ({ label, hint, icon, accept, file, onFile }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const biIcon   = ICON_MAP[icon]   ?? 'bi-file-earmark-fill'
  const accent   = ACCENT_MAP[icon] ?? { color: '#64748b', bg: '#f1f4f9', borderColor: '#d0d7e1' }
  const hasFile  = !!file

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        borderRadius: 14,
        border: `2px dashed ${hasFile ? accent.borderColor : dragging ? accent.color : '#d0d7e1'}`,
        background: hasFile ? accent.bg : dragging ? '#f8faff' : '#ffffff',
        padding: '20px 20px',
        cursor: 'pointer',
        transition: 'all .2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        boxShadow: dragging ? `0 0 0 4px ${accent.color}18` : 'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        onClick={e => e.stopPropagation()}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: accent.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${accent.borderColor}`,
        marginBottom: 4,
      }}>
        <i className={`bi ${biIcon}`} style={{ fontSize: 20, color: accent.color }} />
      </div>

      {/* Label */}
      <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1e293b' }}>{label}</div>

      {/* Hint */}
      <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>{hint}</div>

      {/* File chip */}
      {hasFile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginTop: 4,
          padding: '6px 10px',
          background: '#fff',
          borderRadius: 8,
          border: `1px solid ${accent.borderColor}`,
          fontSize: 12,
          fontWeight: 600,
          color: accent.color,
        }}>
          <i className="bi bi-check-circle-fill" style={{ fontSize: 13 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file!.name}
          </span>
          <button
            onClick={e => { e.stopPropagation(); onFile(null); if (inputRef.current) inputRef.current.value = '' }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: 15, lineHeight: 1, padding: 0, flexShrink: 0,
            }}
            title="Retirer le fichier"
          >
            <i className="bi bi-x" />
          </button>
        </div>
      )}

      {!hasFile && (
        <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <i className="bi bi-cloud-upload" style={{ fontSize: 13 }} />
          Glissez-déposez ou cliquez pour choisir
        </div>
      )}
    </div>
  )
}
