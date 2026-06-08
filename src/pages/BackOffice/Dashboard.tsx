import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'

export const Dashboard = () => {
  const { data, loading, error } = useDashboardMetrics()

  return (
    <section className="space-y-6 p-6 text-slate-800">
      <header className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm uppercase tracking-[0.25em] text-indigo-500">Dashboard principal</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Vue d’ensemble du parc informatique</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Suivez l’état des équipements, des incidents et des demandes avec un tableau de bord moderne et responsive.</p>
      </header>

      {loading && <div className="rounded-3xl bg-white p-6 text-slate-500 shadow-sm ring-1 ring-slate-200">Chargement des métriques…</div>}
      {error && <div className="rounded-3xl bg-rose-50 p-6 text-rose-600 shadow-sm ring-1 ring-rose-200">{error}</div>}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Équipements</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{data.totalAssets}</p>
             
            </article>
            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Tickets Total</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{data.totalTickets}</p>
              <p className="mt-1 text-sm text-sky-600">{data.ticketsByStatus.open} ouverts</p>
            </article>
            {/* <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Tickets en attente</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{data.ticketsByStatus.pending}</p>
              <p className="mt-1 text-sm text-amber-600">Traitement en cours</p>
            </article>
            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">Tickets fermés</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{data.ticketsByStatus.closed}</p>
              <p className="mt-1 text-sm text-violet-600">Taux de résolution stable</p>
            </article> */}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Répartition par type</h2>
                  <p className="text-sm text-slate-500">Vue synthétique du parc informatique</p>
                </div>
                <Link to="/admin/tickets" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Voir les tickets</Link>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {data.assetBreakdown.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-500">{item.label}<span className="font-semibold text-slate-900">{item.value}</span></div>
                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full bg-slate-200" style={{ width: '100%' }}>
                        <div className="h-2 rounded-full" style={{ width: `${Math.min(100, item.value)}%`, backgroundImage: item.accent }} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Tickets par type</h2>
              <div className="mt-6 space-y-4 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 p-4"><div className="flex justify-between"><span>Incidents</span><strong>{data.ticketsByStatus.incidents}</strong></div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="flex justify-between"><span>Demandes</span><strong>{data.ticketsByStatus.requests}</strong></div></div>

              </div>
            </article>
          </div>

          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Tickets récents</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Titre</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Priorité</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-slate-700">#{ticket.id} · {ticket.name}</td>
                      <td className="px-4 py-4"><StatusBadge label={ticket.statusLabel} variant={ticket.statusVariant} /></td>
                      <td className="px-4 py-4"><StatusBadge label={ticket.priorityLabel} variant={ticket.priorityVariant} /></td>
                      <td className="px-4 py-4 text-slate-600">{ticket.ticketType}</td>
                      <td className="px-4 py-4 text-slate-500">{ticket.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </>
      )}
    </section>
  )
}