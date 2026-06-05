import { useEffect, useState } from 'react'
import { listItems } from '@/api/glpi'

export type GlpiComputer = {
    id:number
    name:string
    serial:string
    otherserial:string
    comment:string
}

export function useComputerList() {
    const [computers, setComputers] = useState<GlpiComputer[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchComputers = async () => {
        setLoading(true)
        setError(null)
        try {
            const items = await listItems('Computer')
            setComputers(items as GlpiComputer[])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        fetchComputers()
    }, [])

    return { computers, loading, error, refresh: fetchComputers }
}
