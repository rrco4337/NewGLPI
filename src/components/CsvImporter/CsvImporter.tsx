import { useState, useRef } from 'react'
import type { ImportResult } from '@/pages/BackOffice/Settings'
import './CsvImporter.css'

type ItemType = {
  key: string
  label: string
  icon: string
}

type CsvImporterProps = {
  itemTypes: ItemType[]
  onImport: (itemType: string, rows: Record<string, unknown>[]) => Promise<ImportResult>
}

/**
 * Parse a CSV string into an array of objects.
 * The first row is treated as headers.
 */
const parseCsv = (csvText: string): Record<string, string>[] => {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []

  // Support both comma and semicolon separators (common in French CSVs)
  const separator = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''))

  return lines.slice(1).map(line => {
    const values = line.split(separator).map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      if (header && values[i] !== undefined) {
        row[header] = values[i]
      }
    })
    return row
  })
}

export const CsvImporter = ({ itemTypes, onImport }: CsvImporterProps) => {
  const [selectedType, setSelectedType] = useState(itemTypes[0]?.key || '')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setValidationErrors([])

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = parseCsv(text)

      // Validate
      const errors: string[] = []
      if (rows.length === 0) {
        errors.push('Le fichier CSV est vide ou ne contient qu\'un en-tête.')
      }
      if (rows.length > 0) {
        const keys = Object.keys(rows[0])
        if (keys.length === 0) {
          errors.push('Aucune colonne détectée dans le CSV.')
        }
        if (!keys.includes('name') && !keys.includes('nom')) {
          errors.push('Avertissement : pas de colonne "name" détectée. Vérifiez les en-têtes.')
        }
      }

      setValidationErrors(errors)
      setPreview(rows.slice(0, 5)) // Show first 5 rows
    }
    reader.readAsText(f)
  }

  const handleImport = async () => {
    if (!file) return
    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      const rows = parseCsv(text)
      await onImport(selectedType, rows)
      setIsImporting(false)
      setFile(null)
      setPreview([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div className="csv-importer">
      <div className="import-controls">
        <div className="import-field">
          <label>Type d'objet</label>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
          >
            {itemTypes.map(t => (
              <option key={t.key} value={t.key}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="import-field">
          <label>Fichier CSV</label>
          <div className="file-input-wrapper">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className="file-input-label">
              {file ? `📄 ${file.name}` : '📁 Choisir un fichier CSV...'}
            </label>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="validation-errors">
          {validationErrors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      {/* Preview Table */}
      {preview.length > 0 && (
        <div className="csv-preview">
          <h4>Aperçu ({preview.length} premières lignes)</h4>
          <div className="preview-table-wrapper">
            <table className="preview-table">
              <thead>
                <tr>
                  {Object.keys(preview[0]).map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className="import-button"
            onClick={handleImport}
            disabled={isImporting || validationErrors.some(e => !e.startsWith('Avertissement'))}
          >
            {isImporting ? (
              <>
                <span className="import-spinner"></span>
                Import en cours...
              </>
            ) : (
              <>📥 Importer {file?.name}</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
