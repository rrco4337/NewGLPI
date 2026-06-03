import { useState } from 'react'
import './ConfirmModal.css'

type ConfirmModalProps = {
  title: string
  message: string
  details?: string[]
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal = ({
  title,
  message,
  details,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  const [confirmInput, setConfirmInput] = useState('')
  const confirmPhrase = 'REINITIALISER'
  const isConfirmed = confirmInput === confirmPhrase

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>

        {details && details.length > 0 && (
          <div className="modal-details">
            {details.map((d, i) => (
              <span key={i} className="detail-tag">{d}</span>
            ))}
          </div>
        )}

        <div className="confirm-input-group">
          <label>
            Tapez <strong>{confirmPhrase}</strong> pour confirmer :
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={e => setConfirmInput(e.target.value)}
            placeholder={confirmPhrase}
            autoFocus
          />
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className="confirm-btn"
            onClick={onConfirm}
            disabled={!isConfirmed}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
