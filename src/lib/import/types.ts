// ──────────────── Parsed rows ────────────────

export type GlpiItemType =
  | 'Computer'
  | 'Monitor'
  | 'Printer'
  | 'NetworkEquipment'
  | 'Peripheral'
  | 'Phone'
  | 'Software'

export type AssetRow = {
  rowIndex: number
  name: string
  status: string
  location: string
  manufacturer: string
  itemType: GlpiItemType
  model: string
  inventoryNumber: string
  user: string
}

export type TicketRow = {
  rowIndex: number
  refTicket: number
  date: string        // normalized: YYYY-MM-DD HH:MM:SS
  type: number        // 1=Incident 2=Request
  title: string
  description: string
  status: number      // 1=New 2=Processing 4=Pending 5=Solved 6=Closed
  priority: number    // 1-6
  items: string[]     // asset Name values from CSV1
}

export type CostRow = {
  rowIndex: number
  numTicket: number
  durationSecond: number
  timeCost: number
  fixedCost: number
}

// ──────────────── Images ────────────────

export type ParsedImage = {
  filename: string   // PC-ADM-001.png
  basename: string   // PC-ADM-001
  ext: string        // png
  blob: Blob
  isValid: boolean
  sizeKB: number
}

export type ImageValidationResult = {
  images: ParsedImage[]
  linked: string[]      // basenames matched to a CSV1 row
  orphans: string[]     // basenames with no CSV1 row
  missing: string[]     // CSV1 names with no image
  duplicates: string[]
  corrupt: string[]
}

// ──────────────── Validation ────────────────

export type ValidationError = {
  rowIndex: number
  column: string
  message: string
  severity: 'error' | 'warning'
}

export type Csv1ValidationResult = {
  parsed: AssetRow[]
  errors: ValidationError[]
  hasHardErrors: boolean
}

export type Csv2ValidationResult = {
  parsed: TicketRow[]
  errors: ValidationError[]
  hasHardErrors: boolean
}

export type Csv3ValidationResult = {
  parsed: CostRow[]
  errors: ValidationError[]
  hasHardErrors: boolean
}

export type ValidationSummary = {
  csv1: Csv1ValidationResult
  csv2: Csv2ValidationResult
  csv3: Csv3ValidationResult
  images: ImageValidationResult
  canImport: boolean
}

// ──────────────── Import execution ────────────────

export type ProgressUpdate = {
  phase: 'dropdowns' | 'users' | 'assets' | 'images' | 'tickets' | 'costs' | 'rollback' | 'done'
  message: string
  current: number
  total: number
}

export type CreatedRegistry = {
  computers: Array<{ name: string; id: number }>
  monitors: Array<{ name: string; id: number }>
  tickets: Array<{ ref: number; id: number }>
  documents: Array<{ name: string; id: number }>
  ticketCosts: Array<{ id: number }>
  itemTickets: Array<{ id: number }>
}

export type AssetInfo = {
  itemtype: GlpiItemType
  id: number
}

export type ImportReport = {
  success: boolean
  rolledBack: boolean
  rollbackErrors: string[]
  created: {
    users: number
    computers: number
    monitors: number
    tickets: number
    documents: number
    costs: number
    itemLinks: number
  }
  imageWarnings: string[]
  errors: string[]
}
