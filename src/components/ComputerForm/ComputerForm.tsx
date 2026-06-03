import { type ChangeEvent, type FormEvent } from 'react'
import { StatusMessage } from '@/components/StatusMessage/StatusMessage'
import type { ComputerFormData, AsyncState, FormErrors } from '@/types/glpi'

type ComputerFormProps = {
  formData: ComputerFormData
  submitState: AsyncState
  submitMessage: string | null
  errors: FormErrors
  submitDisabled: boolean
  hasToken: boolean
  hasAppToken: boolean
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function ComputerForm({
  formData,
  submitState,
  submitMessage,
  errors,
  submitDisabled,
  hasToken,
  hasAppToken,
  onChange,
  onSubmit,
}: ComputerFormProps) {
  return (
    <section className="card form-card" aria-labelledby="form-title">
      <div className="card-header">
        <div>
          <h2 id="form-title">Fiche matériel</h2>
          <p className="muted">
            Saisis les informations principales. Les champs critiques sont mis en avant pour un
            ajout rapide.
          </p>
        </div>
        <span className="status">Brouillon auto</span>
      </div>

      <form className="form-grid" autoComplete="off" onSubmit={onSubmit}>
        <label className="field">
          Asset tag
          <input
            name="assetTag"
            placeholder="PC-2026-0142"
            value={formData.assetTag}
            onChange={onChange}
            aria-invalid={!!errors.assetTag}
          />
          {errors.assetTag && <span className="field-error">{errors.assetTag}</span>}
        </label>

        <label className="field">
          Nom d'affichage
          <input
            name="displayName"
            placeholder="Poste graphique"
            value={formData.displayName}
            onChange={onChange}
            aria-invalid={!!errors.displayName}
          />
          {errors.displayName && <span className="field-error">{errors.displayName}</span>}
        </label>

        <label className="field">
          Fabricant
          <input
            name="manufacturer"
            placeholder="Dell"
            value={formData.manufacturer}
            onChange={onChange}
          />
        </label>

        <label className="field">
          Modèle
          <input
            name="model"
            placeholder="Precision 5680"
            value={formData.model}
            onChange={onChange}
          />
        </label>

        <label className="field">
          Numéro de série
          <input
            name="serialNumber"
            placeholder="7H2J9-11A"
            value={formData.serialNumber}
            onChange={onChange}
            aria-invalid={!!errors.serialNumber}
          />
          {errors.serialNumber && <span className="field-error">{errors.serialNumber}</span>}
        </label>

        <label className="field">
          Type
          <select name="type" value={formData.type} onChange={onChange}>
            <option>Portable</option>
            <option>Desktop</option>
            <option>Station graphique</option>
            <option>Mini PC</option>
          </select>
        </label>

        <label className="field">
          Statut
          <select name="status" value={formData.status} onChange={onChange}>
            <option>En stock</option>
            <option>En préparation</option>
            <option>Déployée</option>
            <option>Retiré</option>
          </select>
        </label>

        <label className="field">
          Localisation
          <select name="location" value={formData.location} onChange={onChange}>
            <option>Paris - 3e étage</option>
            <option>Lyon - Atelier</option>
            <option>Remote</option>
          </select>
        </label>

        <label className="field">
          Utilisateur
          <input
            name="owner"
            placeholder="prenom.nom"
            value={formData.owner}
            onChange={onChange}
          />
        </label>

        <label className="field">
          Date d'achat
          <input
            name="purchaseDate"
            type="date"
            value={formData.purchaseDate}
            onChange={onChange}
          />
        </label>

        <label className="field span-2">
          Notes
          <textarea
            name="notes"
            rows={4}
            placeholder="Accessoires, garantie, configuration spéciale"
            value={formData.notes}
            onChange={onChange}
          />
        </label>

        <StatusMessage state={submitState} message={submitMessage} className="span-2" />

        <div className="form-footer span-2">
          <p className="hint">
            {hasToken && hasAppToken
              ? "Pense à rattacher la fiche à un fournisseur si le matériel est encore sous garantie."
              : 'Ajoute un session token et un app token valides pour activer la création GLPI.'}
          </p>
          <div className="actions">
            <button
              className="primary"
              type="submit"
              disabled={submitDisabled}
              aria-busy={submitState === 'loading'}
            >
              {submitState === 'loading' ? 'Création…' : "Créer l'actif"}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
