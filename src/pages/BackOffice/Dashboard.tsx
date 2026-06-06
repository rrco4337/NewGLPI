import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

// ── Stat card ─────────────────────────────────────────────────────────────────
type StatCardProps = {
  icon: string
  label: string
  value: number
  suffix?: string
  color: string
  bgColor: string
  trend?: string
  trendUp?: boolean
}

const StatCard = ({ icon, label, value, suffix = '', color, bgColor, trend, trendUp }: StatCardProps) => {
  const displayed = useCountUp(value)
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '22px 24px',
        border: '1px solid #d0d7e1',
        boxShadow: hov ? '0 8px 24px rgba(0,0,0,.08)' : '0 1px 3px rgba(0,0,0,.05)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'all .2s ease',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: bgColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`bi ${icon}`} style={{ fontSize: 22, color }} />
        </div>
        {trend && (
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
            background: trendUp ? '#dcfce7' : '#fef2f2',
            color: trendUp ? '#16a34a' : '#dc2626',
          }}>
            <i className={`bi bi-arrow-${trendUp ? 'up' : 'down'}-right`} style={{ fontSize: 10 }} />
            {' '}{trend}
          </span>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', letterSpacing: '-.5px', fontVariantNumeric: 'tabular-nums' }}>
          {displayed.toLocaleString('fr-FR')}{suffix}
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  )
}

// ── Activity item ─────────────────────────────────────────────────────────────
type ActivityProps = { dot: string; title: string; desc: string; time: string }
const ActivityItem = ({ dot, title, desc, time }: ActivityProps) => (
  <div style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid #f1f4f9' }}>
    <div style={{ paddingTop: 3 }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: dot, flexShrink: 0,
        boxShadow: `0 0 0 3px ${dot}22`,
      }} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>{desc}</div>
    </div>
    <div style={{ fontSize: 11.5, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{time}</div>
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────
export const Dashboard = () => {
  const { data, loading, error } = useDashboardMetrics()
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: 1200, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>👋</span>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b', letterSpacing: '-.4px' }}>
            {greeting}, Administrateur
          </h1>
        </div>
        <p style={{ color: '#64748b', fontSize: 14.5 }}>
          Voici un aperçu de votre inventaire GLPI — {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {/* Loading / error */}
      {loading && (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '1px solid #d0d7e1', marginBottom: 24, color: '#64748b', fontSize: 14 }}>
          Chargement des métriques…
        </div>
      )}
      {error && (
        <div style={{ background: '#fef2f2', borderRadius: 16, padding: '20px 24px', border: '1px solid #fecaca', marginBottom: 24, color: '#dc2626', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon="bi-pc-display-horizontal" label="Équipements"       value={data?.totalAssets ?? 0}               color="#4f46e5" bgColor="#eef2ff" trend="+8%"  trendUp />
        <StatCard icon="bi-ticket-detailed-fill"  label="Tickets ouverts"   value={data?.ticketsByStatus.open ?? 0}      color="#0ea5e9" bgColor="#e0f2fe" />
        <StatCard icon="bi-clock-history"         label="Tickets en attente" value={data?.ticketsByStatus.pending ?? 0}  color="#f59e0b" bgColor="#fef3c7" />
        <StatCard icon="bi-check-circle-fill"     label="Tickets fermés"    value={data?.ticketsByStatus.closed ?? 0}    color="#10b981" bgColor="#d1fae5" />
      </div>

      {/* Content row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24 }}>

        {/* Activity */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
          padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              <i className="bi bi-activity" style={{ marginRight: 8, color: '#4f46e5' }} />
              Activité récente
            </h2>
            <Link to="/admin/tickets" style={{ fontSize: 12.5, color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>Voir tout →</Link>
          </div>
          <ActivityItem dot="#4f46e5" title="Ordinateur ajouté"    desc="MacBook Pro 16″ (SN: C02Y23899) assigné à Alice"       time="2h" />
          <ActivityItem dot="#10b981" title="Ticket résolu"         desc="Problème de connectivité réseau — Salle 3"             time="5h" />
          <ActivityItem dot="#f59e0b" title="Import GLPI terminé"   desc="248 actifs · 34 tickets · 12 coûts importés"          time="1j" />
          <ActivityItem dot="#0ea5e9" title="Utilisateur créé"      desc="Bob Smith ajouté au groupe Support IT"                time="2j" />
          <ActivityItem dot="#ef4444" title="Alerte système"        desc="Contrat de maintenance expirant dans 30 jours"        time="3j" />
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick actions */}
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
              <i className="bi bi-lightning-charge-fill" style={{ marginRight: 8, color: '#f59e0b' }} />
              Actions rapides
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: 'bi-cloud-upload-fill',      label: 'Nouvel import',        to: '/admin/import',        color: '#4f46e5', bg: '#eef2ff' },
                { icon: 'bi-patch-check-fill',       label: "Vérifier l'import",    to: '/admin/verify-import', color: '#10b981', bg: '#d1fae5' },
                { icon: 'bi-pc-display',             label: "Voir l'inventaire",    to: '/admin/inventory',     color: '#0ea5e9', bg: '#e0f2fe' },
                { icon: 'bi-arrow-counterclockwise', label: 'Réinitialiser',        to: '/admin/reset',         color: '#ef4444', bg: '#fee2e2' },
              ].map(a => (
                <Link key={a.to} to={a.to} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: '#f8fafc', textDecoration: 'none',
                  border: '1px solid #f1f4f9', transition: 'all .15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = a.bg; e.currentTarget.style.borderColor = a.color + '33' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#f1f4f9' }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: a.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <i className={`bi ${a.icon}`} style={{ color: a.color, fontSize: 15 }} />
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#374151' }}>{a.label}</span>
                  <i className="bi bi-chevron-right" style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 12 }} />
                </Link>
              ))}
            </div>
          </div>

          {/* GLPI status */}
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            borderRadius: 16, padding: '20px', color: '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <i className="bi bi-shield-fill-check" style={{ fontSize: 18 }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Statut GLPI</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>API REST connectée</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>Session active</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#facc15' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)' }}>3 alertes en attente</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent tickets */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
        padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
            <i className="bi bi-ticket-detailed" style={{ marginRight: 8, color: '#4f46e5' }} />
            Tickets récents
          </h2>
          <Link to="/admin/tickets" style={{ fontSize: 12.5, color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>Voir tout →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f4f9' }}>
                {['Titre', 'Statut', 'Priorité', 'Demandeur', 'Technicien'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { id: 101, name: 'Connexion réseau impossible',      status: 'open',    priority: 'high',   requester: 'A. Razafindrakoto', technician: 'S. Martin'  },
                { id: 102, name: 'Mise à jour logiciel de compta',   status: 'pending', priority: 'medium', requester: 'L. Dupont',          technician: 'J. Legrand' },
                { id: 103, name: 'Imprimante multifonction HS',      status: 'closed',  priority: 'low',    requester: 'M. Faye',            technician: 'N. Bernard' },
              ].map(ticket => (
                <tr key={ticket.id} style={{ borderBottom: '1px solid #f8fafc' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <td style={{ padding: '12px 16px', color: '#374151', fontWeight: 500 }}>#{ticket.id} · {ticket.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge label={ticket.status} variant={ticket.status as 'open' | 'pending' | 'closed'} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge label={ticket.priority} variant={ticket.priority as 'high' | 'medium' | 'low'} />
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{ticket.requester}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{ticket.technician}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
