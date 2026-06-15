// import { useState, useCallback } from 'react'

import '@/components/GlpiImport/GlpiImport.css'
import { FileUploadZone } from '@/components/GlpiImport/FileUploadZone'
import { ValidationReport } from '@/components/GlpiImport/ValidationReport'
import { ImportProgress } from '@/components/GlpiImport/ImportProgress'
import { ImportFinalReport } from '@/components/GlpiImport/ImportFinalReport'

import '@/components/GlpiImport/GlpiImport.css'

// ── Page-level state machine ──────────────────────────────────────────────────
export const ImportVaovao = () => 
{  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="glpi-import-page">
      <div className="glpi-import-header">
        <h1>
          <i className="bi bi-cloud-upload-fill" style={{ marginRight: 10, color: '#4f46e5', fontSize: 20 }} />
          Import csv vaovao
        </h1>
        <p></p>
      </div>

    

      {/* ── Phase: upload / validated ──────────────────────────────────────── */}
      {(phase === 'upload' || phase === 'validated' || phase === 'validating') && (
        <>
          <div className="upload-grid">
            <FileUploadZone
              label="CSV d'import de csv vaovao  "
              icon="bi-file-earmark-spreadsheet-fill"
              accept=".csv"
            //   file=
              onFile={f => { setFiles(p => ({ ...p, csv1: f })); setValidation(null); setPhase('upload') }}
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