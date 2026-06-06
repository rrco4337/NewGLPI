import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { useTickets } from '@/hooks/useTickets'

export const Tickets = () => {
  const {
    tickets,
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
  } = useTickets()

  return (
    <section className="space-y-6 p-6 text-slate-800">
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm uppercase tracking-[0.25em] text-indigo-500">Gestion des tickets</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Centre de traitement GLPI</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Recherchez, filtrez et suivez les tickets avec une vue complète et responsive.</p>
      </header>

      <div className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Recherche
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Titre, demandeur, technicien..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white" />
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Statut
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white">
            <option value="all">Tous</option>
            <option value="open">Ouverts</option>
            <option value="pending">En attente</option>
            <option value="closed">Fermés</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Priorité
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white">
            <option value="all">Toutes</option>
            <option value="high">Haute</option>
            <option value="medium">Moyenne</option>
            <option value="low">Basse</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Tri
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as 'id' | 'date' | 'priority')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white">
            <option value="id">Plus récent</option>
            <option value="date">Date</option>
            <option value="priority">Priorité</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Ticket</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Priorité</th>
                <th className="px-4 py-3 font-semibold">Demandeur</th>
                <th className="px-4 py-3 font-semibold">Technicien</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Catégorie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Chargement des tickets…</td></tr>}
              {error && <tr><td colSpan={7} className="px-4 py-8 text-center text-rose-600">{error}</td></tr>}
              {!loading && !error && tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <Link to={`/admin/tickets/${ticket.id}`} className="font-semibold text-indigo-600 hover:text-indigo-500">#{ticket.id} · {ticket.name}</Link>
                    <p className="text-xs text-slate-500">Vue détaillée et historique</p>
                  </td>
                  <td className="px-4 py-4"><StatusBadge label={String(ticket.status)} variant={ticket.status === 'closed' ? 'closed' : ticket.status === 'pending' ? 'pending' : 'open'} /></td>
                  <td className="px-4 py-4"><StatusBadge label={String(ticket.priority)} variant={ticket.priority === 'high' ? 'high' : ticket.priority === 'medium' ? 'medium' : 'low'} /></td>
                  <td className="px-4 py-4 text-slate-700">{ticket.requester_name || 'Non renseigné'}</td>
                  <td className="px-4 py-4 text-slate-700">{ticket.technician_name || 'À assigner'}</td>
                  <td className="px-4 py-4 text-slate-500">{ticket.date || '—'}</td>
                  <td className="px-4 py-4 text-slate-500">{ticket.category || 'Sans catégorie'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>Page {page} sur {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">Précédent</button>
            <button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50">Suivant</button>
          </div>
        </div>
      </div>
    </section>
  )
}
