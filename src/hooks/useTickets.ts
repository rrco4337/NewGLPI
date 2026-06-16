import { useEffect, useMemo, useState } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import { normalizeTicketPriority, normalizeTicketStatus } from '@/lib/ticketStatus'
import type { GlpiTicket } from '@/types/glpi'

export const useTickets = () => {
  const [tickets, setTickets] = useState<GlpiTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'new' | 'in-progress' | 'pending' | 'closed'>('all')
  const [priority, setPriority] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [sortKey, setSortKey] = useState<'id' | 'date' | 'priority'>('id')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let mounted = true

    const loadTickets = async () => {
      setLoading(true)
      try {
        const data = await glpiTicketService.listTickets()
        if (mounted && data) setTickets(data as GlpiTicket[])
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Impossible de récupérer les tickets.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadTickets()
    return () => {
      mounted = false
    }
  }, [])

  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return tickets
      .filter((ticket) => {
        const ticketStatus = normalizeTicketStatus(ticket.status)
        const ticketPriority = normalizeTicketPriority(ticket.priority)
        const matchesQuery = !normalized || [ticket.name, ticket.requester_name, ticket.technician_name, ticket.category].some((value) => value?.toLowerCase().includes(normalized))
        const matchesStatus = status === 'all' || ticketStatus === status
        const matchesPriority = priority === 'all' || ticketPriority === priority
        return matchesQuery && matchesStatus && matchesPriority
      })
      .sort((left, right) => {
        if (sortKey === 'date') return new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime()
        if (sortKey === 'priority') return String(left.priority).localeCompare(String(right.priority))
        return right.id - left.id
      })
  }, [query, status, priority, sortKey, tickets])

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / 8))
  const pagedTickets = filteredTickets.slice((page - 1) * 8, page * 8)

  useEffect(() => setPage(1), [query, status, priority])

  return {
    tickets: pagedTickets,
    allTickets: filteredTickets,
    loading,
    error,
    query,
    setQuery,
    status,
    setStatus,
    priority,
    setPriority,
    sortKey,
    setSortKey,
    page,
    setPage,
    totalPages,
  }
}
