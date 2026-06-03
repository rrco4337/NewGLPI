export type ComputerFormData = {
  assetTag: string
  displayName: string
  manufacturer: string
  model: string
  serialNumber: string
  type: string
  status: string
  location: string
  owner: string
  purchaseDate: string
  notes: string
}

export type AsyncState = 'idle' | 'loading' | 'success' | 'error'

export type FormErrors = Partial<Record<keyof ComputerFormData, string>>
