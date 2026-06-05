import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { glpiTicketService } from '@/services/glpiService'
import type { TicketDetail as TicketDetailType } from '@/types/glpi'

export const TicketDetail = () => {
  const { id } = useParams()
  const [ticket, setTicket] = useState<TicketDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const detail = await glpiTicketService.getTicket(Number(id))
        setTicket(detail)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Impossible de charger le ticket')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id])

  if (loading) return <div className="p-6 text-slate-500">Chargement de la fiche…</div>
  if (error || !ticket) return <div className="p-6 text-rose-600">{error ?? 'Ticket introuvable.'}</div>

  return (
    <section className="space-y-6 p-6 text-slate-800">
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm uppercase tracking-[0.25em] text-indigo-500">Fiche détaillée ticket</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">#{ticket.id} · {ticket.name}</h1>
        <p className="mt-2 text-slate-600">Historique, commentaires, documents et statuts de suivi de l’intervention.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Description</h2>
          <p className="mt-4 text-slate-600">{ticket.description || ticket.content || 'Aucune description n’est disponible.'}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <StatusBadge label={String(ticket.status)} variant={ticket.status === 'closed' ? 'closed' : ticket.status === 'pending' ? 'pending' : 'open'} />
            <StatusBadge label={String(ticket.priority)} variant={ticket.priority === 'high' ? 'high' : ticket.priority === 'medium' ? 'medium' : 'low'} />
          </div>
        </article>

        <aside className="space-y-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Technicien assigné</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{ticket.technician_name || 'Non assigné'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Demandeur</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{ticket.requester_name || 'Inconnu'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dates importantes</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              <li>Créé le : {ticket.date || '—'}</li>
              <li>Clôture : {ticket.closedate || '—'}</li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Historique</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {(ticket.history || []).map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <strong className="text-slate-900">{entry.action}</strong>
                <p className="text-xs text-slate-500">{entry.date} · {entry.author}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Commentaires</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {(ticket.comments || []).map((comment) => (
              <li key={comment.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p>{comment.content}</p>
                <p className="mt-1 text-xs text-slate-500">{comment.date} · {comment.author}</p>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">Documents attachés</h2>
        <ul className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
          {(ticket.documents || []).map((document) => (
            <li key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">📎 {document.filename}</li>
          ))}
        </ul>
      </article>
    </section>
  )
}
