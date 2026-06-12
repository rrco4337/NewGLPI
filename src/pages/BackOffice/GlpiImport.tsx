import { useState, useCallback } from 'react'
import { FileUploadZone } from '@/components/GlpiImport/FileUploadZone'
import { ValidationReport } from '@/components/GlpiImport/ValidationReport'
import { ImportProgress } from '@/components/GlpiImport/ImportProgress'
import { ImportFinalReport } from '@/components/GlpiImport/ImportFinalReport'
import { parseCsvText } from '@/lib/import/csvParser'
import { validateCsv1, validateCsv2, validateCsv3, validateImages } from '@/lib/import/validators'
import { extractImagesFromZip } from '@/lib/import/imageExtractor'
import { runImport } from '@/lib/import/importOrchestrator'
import type { ValidationSummary, ImportReport, ProgressUpdate } from '@/lib/import/types'
import '@/components/GlpiImport/GlpiImport.css'

// ── Page-level state machine ──────────────────────────────────────────────────

type Phase = 'upload' | 'validating' | 'validated' | 'importing' | 'done'

type FileSet = {
  csv1: File | null  // Inventaire
  csv2: File | null  // Tickets
  csv3: File | null  // Coûts
  zip:  File | null  // Images
}

const EMPTY_FILES: FileSet = { csv1: null, csv2: null, csv3: null, zip: null }

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string ?? '')
    reader.onerror = reject
    reader.readAsText(file, 'UTF-8')
  })

// ── Component ─────────────────────────────────────────────────────────────────

export const GlpiImport = () => {
  const [phase, setPhase] = useState<Phase>('upload')
  const [files, setFiles] = useState<FileSet>(EMPTY_FILES)
  const [validation, setValidation] = useState<ValidationSummary | null>(null)
  const [progress, setProgress] = useState<ProgressUpdate>({ phase: 'dropdowns', message: '', current: 0, total: 0 })
  const [report, setReport] = useState<ImportReport | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  const anyFileSelected = !!(files.csv1 || files.csv2 || files.csv3 || files.zip)

  // ── Validate ──────────────────────────────────────────────────────────────
  const handleValidate = useCallback(async () => {
    if (!anyFileSelected) return
    setPhase('validating')
    setGlobalError(null)

    try {
      const [text1, text2, text3] = await Promise.all([
        files.csv1 ? readFileAsText(files.csv1) : Promise.resolve(''),
        files.csv2 ? readFileAsText(files.csv2) : Promise.resolve(''),
        files.csv3 ? readFileAsText(files.csv3) : Promise.resolve(''),
      ])

      const { rows: raw1 } = text1 ? parseCsvText(text1) : { rows: [] }
      const { rows: raw2 } = text2 ? parseCsvText(text2) : { rows: [] }
      const { rows: raw3 } = text3 ? parseCsvText(text3) : { rows: [] }

      const csv1Result = validateCsv1(raw1)
      const csv2Result = validateCsv2(raw2)

      const validRefs = new Set(csv2Result.parsed.map(t => t.refTicket))
      const csv3Result = validateCsv3(raw3, validRefs)

      const parsedImages = files.zip ? await extractImagesFromZip(files.zip) : []
      const assetNames = new Set(csv1Result.parsed.map(a => a.name.toLowerCase()))
      const imageResult = await validateImages(parsedImages, assetNames)

      const canImport =
        !csv1Result.hasHardErrors &&
        !csv2Result.hasHardErrors &&
        !csv3Result.hasHardErrors

      const summary: ValidationSummary = {
        csv1: csv1Result,
        csv2: csv2Result,
        csv3: csv3Result,
        images: imageResult,
        canImport,
      }

      setValidation(summary)
      setPhase('validated')
    } catch (e: unknown) {
      setGlobalError(`Erreur lors de la validation : ${e instanceof Error ? e.message : String(e)}`)
      setPhase('upload')
    }
  }, [files])

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!validation?.canImport) return
    setPhase('importing')
    setGlobalError(null)

    const token = localStorage.getItem('glpi_session_token') ?? undefined

    try {
      const result = await runImport(
        validation.csv1.parsed,
        validation.csv2.parsed,
        validation.csv3.parsed,
        validation.images.images,
        (update: ProgressUpdate) => setProgress({ ...update }),
        token,
      )
      setReport(result)
      setPhase('done')
    } catch (e: unknown) {
      setGlobalError(`Erreur inattendue : ${e instanceof Error ? e.message : String(e)}`)
      setPhase('validated')
    }
  }, [validation])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setPhase('upload')
    setFiles(EMPTY_FILES)
    setValidation(null)
    setReport(null)
    setGlobalError(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="glpi-import-page">
      <div className="glpi-import-header">
        <h1>
          <i className="bi bi-cloud-upload-fill" style={{ marginRight: 10, color: '#4f46e5', fontSize: 20 }} />
          Import GLPI
        </h1>
        <p>Importez simultanément l'inventaire, les tickets, les coûts et les images.</p>
      </div>

      {globalError && (
        <div className="validation-err-banner" style={{ marginBottom: '1rem' }}>
          <i className="bi bi-exclamation-circle-fill" style={{ fontSize: 15, flexShrink: 0 }} />
          {globalError}
        </div>
      )}

      {/* ── Phase: upload / validated ──────────────────────────────────────── */}
      {(phase === 'upload' || phase === 'validated' || phase === 'validating') && (
        <>
          <div className="upload-grid">
            <FileUploadZone
              label="CSV 1 — Inventaire"
              hint="Colonnes : Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User"
              icon="bi-file-earmark-spreadsheet-fill"
              accept=".csv"
              file={files.csv1}
              onFile={f => { setFiles(p => ({ ...p, csv1: f })); setValidation(null); setPhase('upload') }}
            />
            <FileUploadZone
              label="CSV 2 — Tickets"
              hint="Colonnes : Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items"
              icon="bi-ticket-detailed-fill"
              accept=".csv"
              file={files.csv2}
              onFile={f => { setFiles(p => ({ ...p, csv2: f })); setValidation(null); setPhase('upload') }}
            />
            <FileUploadZone
              label="CSV 3 — Coûts"
              hint="Colonnes : Num_Ticket, Duration_second, Time_Cost, Fixed_Cost"
              icon="bi-currency-euro"
              accept=".csv"
              file={files.csv3}
              onFile={f => { setFiles(p => ({ ...p, csv3: f })); setValidation(null); setPhase('upload') }}
            />
            <FileUploadZone
              label="Images ZIP"
              hint="Images nommées par asset (ex. PC-ADM-001.png) — formats : jpg, jpeg, png, webp"
              icon="bi-file-zip-fill"
              accept=".zip"
              file={files.zip}
              onFile={f => { setFiles(p => ({ ...p, zip: f })); setValidation(null); setPhase('upload') }}
            />
          </div>

          <div className="import-action-bar">
            <button
              className="btn-verify"
              onClick={handleValidate}
              disabled={!anyFileSelected || phase === 'validating'}
            >
              {phase === 'validating'
                ? <><i className="bi bi-hourglass-split" style={{ marginRight: 6 }} />Validation…</>
                : <><i className="bi bi-search" style={{ marginRight: 6 }} />Vérifier les fichiers</>
              }
            </button>

            {phase === 'validated' && validation?.canImport && (
              <button className="btn-import" onClick={handleImport}>
                <i className="bi bi-rocket-takeoff-fill" style={{ marginRight: 6 }} />Lancer l'import
              </button>
            )}

            {(phase === 'validated' || phase === 'validating') && (
              <button className="btn-cancel" onClick={handleReset}>
                Annuler
              </button>
            )}
          </div>

          {validation && phase === 'validated' && (
            <ValidationReport summary={validation} />
          )}
        </>
      )}

      {/* ── Phase: importing ───────────────────────────────────────────────── */}
      {phase === 'importing' && (
        <ImportProgress progress={progress} />
      )}

      {/* ── Phase: done ────────────────────────────────────────────────────── */}
      {phase === 'done' && report && (
        <ImportFinalReport report={report} onReset={handleReset} />
      )}
    </div>
  )
}
