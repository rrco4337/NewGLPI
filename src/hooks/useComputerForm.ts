import { useState, type ChangeEvent, type FormEvent } from 'react'
import { createComputer } from '@/api/glpi'
import type { ComputerFormData, AsyncState, FormErrors } from '@/types/glpi'

const INITIAL_FORM: ComputerFormData = {
  assetTag: 'PC-2026-0142',
  displayName: 'Poste graphique',
  manufacturer: 'Dell',
  model: 'Precision 5680',
  serialNumber: '7H2J9-11A',
  type: 'Portable',
  status: 'En stock',
  location: 'Paris - 3e étage',
  owner: 'prenom.nom',
  purchaseDate: '',
  notes: '',
}

const validate = (data: ComputerFormData): FormErrors => {
  const errors: FormErrors = {}
  if (!data.displayName.trim()) errors.displayName = 'Le nom est requis'
  if (!data.assetTag.trim()) errors.assetTag = "L'asset tag est requis"
  if (!data.serialNumber.trim()) errors.serialNumber = 'Le numéro de série est requis'
  return errors
}

export function useComputerForm() {
  const [formData, setFormData] = useState<ComputerFormData>(INITIAL_FORM)
  const [submitState, setSubmitState] = useState<AsyncState>('idle')
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof ComputerFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validate(formData)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSubmitState('loading')
    setSubmitMessage(null)
    try {
      const response = await createComputer(formData)
      const id = (response?.id ?? response?.[0]?.id) as number | undefined
      setSubmitState('success')
      setSubmitMessage(id ? `Actif créé (#${id})` : 'Actif créé')
    } catch (error) {
      setSubmitState('error')
      setSubmitMessage(error instanceof Error ? error.message : 'Création impossible')
    }
  }

  const resetForm = () => {
    setFormData(INITIAL_FORM)
    setSubmitState('idle')
    setSubmitMessage(null)
    setErrors({})
  }

  return { formData, submitState, submitMessage, errors, handleChange, handleSubmit, resetForm }
}
