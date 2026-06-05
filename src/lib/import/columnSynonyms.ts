// Maps canonical field names to accepted synonyms (case-insensitive at runtime).
// Extend this dictionary to add more languages or aliases.
export const COLUMN_SYNONYMS: Record<string, string[]> = {
  // ── CSV 1 – Assets ──────────────────────────────────────────
  name: [
    'name', 'nom', 'anarana', 'designation', 'désignation', 'appellation', 'label',
  ],
  status: [
    'status', 'statut', 'état', 'etat', 'toetry', 'etat_actuel', 'state',
  ],
  location: [
    'location', 'localisation', 'emplacement', 'toerana', 'lieu', 'salle', 'site',
  ],
  manufacturer: [
    'manufacturer', 'fabricant', 'mpanamboatra', 'marque', 'brand', 'constructeur',
  ],
  item_type: [
    'item_type', 'itemtype', 'type', 'karazana', 'type_objet',
    'type_element', 'type_actif', 'asset_type',
  ],
  model: [
    'model', 'modèle', 'modele', 'modely', 'référence', 'reference', 'ref_model',
  ],
  inventory_number: [
    'inventory_number', 'numero_inventaire', 'num_inventaire', 'asset_tag',
    'inv_number', 'laharana', 'numero_actif', 'n_inventaire', 'otherserial',
  ],
  user: [
    'user', 'utilisateur', 'mpampiasa', 'owner', 'propriétaire', 'proprietaire',
    'assigned_to', 'responsable',
  ],

  // ── CSV 2 – Tickets ─────────────────────────────────────────
  ref_ticket: [
    'ref_ticket', 'ref', 'id', 'num', 'numero_ticket', 'ticket_id', 'nifankaiky',
    'reference', 'ticket_ref',
  ],
  date: [
    'date', 'daty', 'date_creation', 'created_at', 'daty_namorana', 'creation_date',
  ],
  heure: [
    'heure', 'hora', 'time', 'fotoana', 'time_created', 'heures', 'heure_creation',
  ],
  titre: [
    'titre', 'title', 'lohateny', 'subject', 'sujet', 'objet', 'object',
  ],
  description: [
    'description', 'content', 'contenu', 'famaritana', 'detail',
    'details', 'détails', 'body',
  ],
  priority: [
    'priority', 'priorité', 'priorite', 'laharam-pony', 'urgence', 'level',
    'niveau', 'importance',
  ],
  items: [
    'items', 'objets', 'assets', 'equipements', 'équipements',
    'fitaovana', 'linked_items', 'materiel', 'matériel',
  ],

  // ── CSV 3 – Costs ────────────────────────────────────────────
  num_ticket: [
    'num_ticket', 'numero_ticket', 'ref_ticket', 'ticket_id',
    'nifankaiky', 'id_ticket', 'ticket',
  ],
  duration_second: [
    'duration_second', 'duration_seconds', 'duree_seconde', 'duration',
    'duree', 'faharetana', 'temps_secondes', 'secondes', 'action_time',
  ],
  time_cost: [
    'time_cost', 'cout_temps', 'cout_horaire', 'vidim-potoana',
    'hourly_cost', 'cost_time', 'cost_h',
  ],
  fixed_cost: [
    'fixed_cost', 'cout_fixe', 'vidy', 'flat_cost',
    'frais_fixes', 'montant_fixe', 'fixed',
  ],
}

// Returns the canonical key for a given header, or null if unknown.
export function normalizeHeader(raw: string): string | null {
  const lower = raw.toLowerCase().trim()
  for (const [canonical, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    if (synonyms.includes(lower)) return canonical
  }
  return null
}
