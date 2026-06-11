import { useEffect, useState } from 'react'
import { glpiDashboardService } from '@/services/glpiService'

export const useDashboardMetrics = () => {
  const [data, setData] = useState<{
    totalAssets: number
    totalTickets: number
    assetBreakdown: Array<{ label: string; value: number; accent: string; detail: string }>
    ticketsByStatus: { open: number; closed: number; pending: number; incidents: number; requests: number }
    costs: { totalFixedCost: number; totalTimeCost: number; totalCost: number }
    recentTickets: Array<{
      id: number
      name: string
      statusLabel: string
      statusVariant: 'open' | 'pending' | 'closed'
      priorityLabel: string
      priorityVariant: 'low' | 'medium' | 'high'
      ticketType: string
      date: string
    }>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      try {
        const overview = await glpiDashboardService.getOverview()
        if (mounted) setData(overview)
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Impossible de charger le dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  return { data, loading, error }
}
