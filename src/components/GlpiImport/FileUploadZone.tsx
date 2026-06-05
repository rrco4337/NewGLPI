import { useRef, useState } from 'react'

type Props = {
  label: string
  hint: string
  icon: string
  accept: string
  file: File | null
  onFile: (f: File | null) => void
}

export const FileUploadZone = ({ label, hint, icon, accept, file, onFile }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      className={`upload-zone ${file ? 'has-file' : ''} ${dragging ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onClick={e => e.stopPropagation()}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />

      <span className="upload-zone-icon">{icon}</span>
      <span className="upload-zone-label">{label}</span>
      <span className="upload-zone-hint">{hint}</span>

      {file && (
        <>
          <span className="upload-zone-filename">📄 {file.name}</span>
          <button
            className="upload-zone-clear"
            onClick={e => { e.stopPropagation(); onFile(null); if (inputRef.current) inputRef.current.value = '' }}
            title="Retirer le fichier"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}
