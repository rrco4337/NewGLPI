import type { ComputerFormData } from '@/types/glpi'

type SummaryPanelProps = {
  formData: ComputerFormData
}

export function SummaryPanel({ formData }: SummaryPanelProps) {
  const subtitle =
    formData.displayName || formData.assetTag
      ? `${formData.displayName || formData.assetTag} · ${formData.serialNumber || 'S/N non renseigné'}`
      : 'Renseignez la fiche pour voir le résumé.'

  return (
    <section className="card summary-card" aria-labelledby="summary-title">
      <h2 id="summary-title">Résumé rapide</h2>
      <div className="summary-grid">
        <div>
          <p className="summary-label">Statut</p>
          <p className="summary-value">{formData.status || 'En stock'}</p>
        </div>
        <div>
          <p className="summary-label">Type</p>
          <p className="summary-value">{formData.type || 'Portable'}</p>
        </div>
        <div>
          <p className="summary-label">Localisation</p>
          <p className="summary-value">{formData.location || 'Paris - 3e étage'}</p>
        </div>
        <div>
          <p className="summary-label">Date d'achat</p>
          <p className="summary-value">
            {formData.purchaseDate
              ? new Date(formData.purchaseDate).toLocaleDateString('fr-FR')
              : '—'}
          </p>
        </div>
      </div>
      <div className="divider" />
      <p className="muted">{subtitle}</p>
    </section>
  )
}
