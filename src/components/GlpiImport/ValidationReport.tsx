import type { ValidationSummary, ValidationError } from '@/lib/import/types'

type Props = {
  summary: ValidationSummary
}

const ErrorList = ({ errors, max = 8 }: { errors: ValidationError[]; max?: number }) => {
  const shown = errors.slice(0, max)
  return (
    <ul className="error-list">
      {shown.map((e, i) => (
        <li key={i}>
          <span className={e.severity === 'error' ? 'err-icon' : 'warn-icon'}>
            {e.severity === 'error' ? '✗' : '⚠'}
          </span>
          {e.rowIndex > 0 && <span className="row-tag">L.{e.rowIndex}</span>}
          <strong>{e.column}</strong> — {e.message}
        </li>
      ))}
      {errors.length > max && (
        <li style={{ color: '#888', fontStyle: 'italic' }}>
          … et {errors.length - max} autre(s)
        </li>
      )}
    </ul>
  )
}

const CsvSection = ({
  title,
  validCount,
  errorCount,
  warnCount,
  errors,
}: {
  title: string
  validCount: number
  errorCount: number
  warnCount: number
  errors: ValidationError[]
}) => (
  <div className="validation-section">
    <div className="validation-section-title">{title}</div>
    <div className="val-counts">
      <span className="val-count ok">✓ {validCount} valide{validCount !== 1 ? 's' : ''}</span>
      {warnCount > 0 && <span className="val-count warn">⚠ {warnCount} avertissement{warnCount !== 1 ? 's' : ''}</span>}
      {errorCount > 0 && <span className="val-count err">✗ {errorCount} erreur{errorCount !== 1 ? 's' : ''}</span>}
    </div>
    {errors.length > 0 && <ErrorList errors={errors} />}
  </div>
)

export const ValidationReport = ({ summary }: Props) => {
  const { csv1, csv2, csv3, images } = summary

  const countBy = (errs: ValidationError[], sev: 'error' | 'warning') =>
    errs.filter(e => e.severity === sev).length

  return (
    <div className="validation-report">
      <h2>Rapport de validation</h2>

      {summary.canImport ? (
        <div className="validation-ok-banner">✅ Validation réussie — prêt à importer</div>
      ) : (
        <div className="validation-err-banner">❌ Des erreurs bloquantes empêchent l'import — corrigez les fichiers</div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <CsvSection
          title="📋 Fichier 1 — Inventaire"
          validCount={csv1.parsed.length}
          errorCount={countBy(csv1.errors, 'error')}
          warnCount={countBy(csv1.errors, 'warning')}
          errors={csv1.errors}
        />

        <CsvSection
          title="🎫 Fichier 2 — Tickets"
          validCount={csv2.parsed.length}
          errorCount={countBy(csv2.errors, 'error')}
          warnCount={countBy(csv2.errors, 'warning')}
          errors={csv2.errors}
        />

        <CsvSection
          title="💰 Fichier 3 — Coûts"
          validCount={csv3.parsed.length}
          errorCount={countBy(csv3.errors, 'error')}
          warnCount={countBy(csv3.errors, 'warning')}
          errors={csv3.errors}
        />

        <div className="validation-section">
          <div className="validation-section-title">🖼 Images ZIP</div>
          <div className="val-counts">
            <span className="val-count info">📁 {images.images.length} trouvée{images.images.length !== 1 ? 's' : ''}</span>
            <span className="val-count ok">🔗 {images.linked.length} liée{images.linked.length !== 1 ? 's' : ''}</span>
            {images.orphans.length > 0 && (
              <span className="val-count warn">👻 {images.orphans.length} orpheline{images.orphans.length !== 1 ? 's' : ''}</span>
            )}
            {images.missing.length > 0 && (
              <span className="val-count warn">❓ {images.missing.length} manquante{images.missing.length !== 1 ? 's' : ''}</span>
            )}
            {images.duplicates.length > 0 && (
              <span className="val-count warn">♊ {images.duplicates.length} doublon{images.duplicates.length !== 1 ? 's' : ''}</span>
            )}
            {images.corrupt.length > 0 && (
              <span className="val-count err">💀 {images.corrupt.length} corrompue{images.corrupt.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {images.orphans.length > 0 && (
            <ul className="error-list">
              {images.orphans.map(o => (
                <li key={o}><span className="warn-icon">⚠</span> Image orpheline : {o}</li>
              ))}
            </ul>
          )}
          {images.missing.length > 0 && (
            <ul className="error-list">
              {images.missing.map(m => (
                <li key={m}><span className="warn-icon">⚠</span> Image manquante pour : {m}</li>
              ))}
            </ul>
          )}
          {images.corrupt.length > 0 && (
            <ul className="error-list">
              {images.corrupt.map(c => (
                <li key={c}><span className="err-icon">✗</span> Fichier corrompu : {c}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
