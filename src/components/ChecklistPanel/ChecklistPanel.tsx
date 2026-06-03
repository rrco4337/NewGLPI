export function ChecklistPanel() {
  return (
    <section className="card checklist-card" aria-labelledby="checklist-title">
      <h2 id="checklist-title">Contrôle rapide</h2>
      <ul className="checklist">
        <li>Vérification du numéro de série</li>
        <li>Photos avant mise en service</li>
        <li>Étiquette QR imprimée</li>
        <li>Attribution utilisateur validée</li>
      </ul>
      <div className="timeline">
        <div>
          <span className="step">1</span>
          <div>
            <p className="summary-value">Préparation</p>
            <p className="muted">Matériel reçu, test rapide</p>
          </div>
        </div>
        <div>
          <span className="step">2</span>
          <div>
            <p className="summary-value">Inventaire</p>
            <p className="muted">Ajout fiche + étiquetage</p>
          </div>
        </div>
        <div>
          <span className="step">3</span>
          <div>
            <p className="summary-value">Livraison</p>
            <p className="muted">Signature et remise utilisateur</p>
          </div>
        </div>
      </div>
    </section>
  )
}
