import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { glpiTicketService } from '@/services/glpiService'
import { getTicketPriorityLabel, getTicketPriorityVariant, getTicketStatusLabel, getTicketStatusVariant } from '@/lib/ticketStatus'
import type { TicketDetail as TicketDetailType } from '@/types/glpi'

const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

function fmtDuration(seconds: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`
  if (m > 0) return `${m}min ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

const ITEMTYPE_ICON: Record<string, string> = {
  Computer: 'bi-laptop', Monitor: 'bi-display', Phone: 'bi-phone',
  Printer: 'bi-printer', NetworkEquipment: 'bi-hdd-network',
  Peripheral: 'bi-mouse2', Software: 'bi-box', Rack: 'bi-server',
}

export const TicketDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<TicketDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

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

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 14 }}>
        Chargement de la fiche…
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div style={{ padding: '32px 32px 48px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13.5, color: '#64748b' }}>
          <span style={{ cursor: 'pointer', color: '#4f46e5' }} onClick={() => navigate('/admin/tickets')}>Tickets</span>
          <i className="bi bi-chevron-right" style={{ fontSize: 11 }} />
          <span>Erreur</span>
        </div>
        <div style={{ color: '#ef4444', fontSize: 14 }}>{error ?? 'Ticket introuvable.'}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: 1200, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13.5, color: '#64748b' }}>
        <span
          style={{ cursor: 'pointer', color: '#4f46e5', fontWeight: 500 }}
          onClick={() => navigate('/admin/tickets')}
        >
          Tickets
        </span>
        <i className="bi bi-chevron-right" style={{ fontSize: 11 }} />
        <span style={{ color: '#1e293b', fontWeight: 600 }}>#{ticket.id}</span>
      </div>

      {/* Header card */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: 20, padding: '28px 32px', marginBottom: 24,
        boxShadow: '0 8px 32px rgba(79,70,229,.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', marginBottom: 6 }}>
              Fiche ticket
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-.3px' }}>
              #{ticket.id} · {ticket.name || '(Sans titre)'}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusBadge label={getTicketStatusLabel(ticket.status)} variant={getTicketStatusVariant(ticket.status)} />
            <StatusBadge label={getTicketPriorityLabel(ticket.priority)} variant={getTicketPriorityVariant(ticket.priority)} />
          </div>
        </div>
      </div>

      {/* Main two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginBottom: 20 }}>

        {/* Description + timeline */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
          padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
            <i className="bi bi-file-text" style={{ marginRight: 8, color: '#4f46e5' }} />
            Description
          </h2>
          <div
            style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}
            dangerouslySetInnerHTML={{ __html: ticket.content || ticket.description || 'Aucune description disponible.' }}
          />

          {/* Timeline */}
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '24px 0 14px' }}>
            <i className="bi bi-clock-history" style={{ marginRight: 8, color: '#4f46e5' }} />
            Historique
          </h2>
          {(ticket.history ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Aucun historique disponible.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ticket.history!.map(entry => (
                <div key={entry.id} style={{
                  background: '#f8fafc', borderRadius: 10, padding: '12px 16px',
                  border: '1px solid #e2e8f0', fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{entry.action}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                    {entry.date}{entry.author ? ` · ${entry.author}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply box */}
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '24px 0 14px' }}>
            <i className="bi bi-reply-fill" style={{ marginRight: 8, color: '#4f46e5' }} />
            Répondre
          </h2>
          <div style={{ border: '1.5px solid #d0d7e1', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid #f1f4f9', background: '#f8fafc' }}>
              {['bi-type-bold', 'bi-type-italic', 'bi-type-underline', 'bi-paperclip', 'bi-link-45deg'].map(icon => (
                <button key={icon} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14, padding: '2px 6px', borderRadius: 4 }}>
                  <i className={`bi ${icon}`} />
                </button>
              ))}
            </div>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Écrire une réponse ou une solution…"
              style={{
                width: '100%', minHeight: 100, padding: '14px 16px',
                border: 'none', outline: 'none', resize: 'vertical',
                fontSize: 13.5, color: '#1e293b', background: '#fff',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #f1f4f9', background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                {['Réponse', 'Note', 'Résolution'].map((tab, i) => (
                  <span key={tab} style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 500, color: i === 0 ? '#4f46e5' : '#64748b', background: i === 0 ? '#eef2ff' : 'transparent' }}>{tab}</span>
                ))}
              </div>
              <button style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff',
                border: 'none', borderRadius: 8, padding: '8px 18px',
                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              }}>
                Envoyer
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Info card */}
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
              <i className="bi bi-info-circle" style={{ marginRight: 8, color: '#4f46e5' }} />
              Informations
            </h3>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>Demandeur</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#4f46e5', fontWeight: 700, fontSize: 13 }}>R</span>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{ticket.requester_name ?? ticket.requester?.name ?? 'Inconnu'}</span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>Technicien assigné</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#7c3aed', fontWeight: 700, fontSize: 13 }}>T</span>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{ticket.technician_name ?? ticket.technician?.name ?? 'Non assigné'}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f4f9', paddingTop: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 8 }}>Dates</p>
              <div style={{ fontSize: 13, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Créé le : <strong style={{ color: '#1e293b' }}>{ticket.date ?? '—'}</strong></span>
                <span>Clôture : <strong style={{ color: '#1e293b' }}>{ticket.closedate ?? '—'}</strong></span>
              </div>
            </div>
          </div>

          {/* Documents card */}
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
              <i className="bi bi-paperclip" style={{ marginRight: 8, color: '#4f46e5' }} />
              Documents
            </h3>
            {(ticket.documents ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Aucun document.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ticket.documents!.map(doc => (
                  <div key={doc.id} style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', border: '1px solid #e2e8f0', fontSize: 13, color: '#374151' }}>
                    <i className="bi bi-paperclip" style={{ marginRight: 5 }} />{doc.filename}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked assets card */}
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
              <i className="bi bi-hdd-stack" style={{ marginRight: 8, color: '#4f46e5' }} />
              Équipements liés
              {(ticket.linkedItems ?? []).length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, background: '#eef2ff', color: '#4f46e5', borderRadius: 20, padding: '2px 8px' }}>
                  {ticket.linkedItems!.length}
                </span>
              )}
            </h3>
            {(ticket.linkedItems ?? []).length === 0 ? (
              <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Aucun équipement lié.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ticket.linkedItems!.map(item => (
                  <div key={item.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className={`bi ${ITEMTYPE_ICON[item.itemtype] ?? 'bi-box'}`} style={{ fontSize: 16, color: '#6366f1', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>
                        {item.itemName ?? `#${item.items_id}`}
                      </p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>{item.itemtype}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
        padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
          <i className="bi bi-chat-left-text" style={{ marginRight: 8, color: '#4f46e5' }} />
          Commentaires
        </h2>
        {(ticket.comments ?? []).length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Aucun commentaire.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ticket.comments!.map(comment => (
              <div key={comment.id} style={{
                background: '#f8fafc', borderRadius: 12, padding: '14px 18px',
                border: '1px solid #e2e8f0', fontSize: 13.5, color: '#475569', lineHeight: 1.5,
              }}>
                <p>{comment.content}</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                  {comment.date}{comment.author ? ` · ${comment.author}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Costs section */}
      {(ticket.costs ?? []).length > 0 && (() => {
        const costs = ticket.costs!
        const totalTime = costs.reduce((s, c) => s + c.cost_time * (c.actiontime / 3600), 0)
        const totalFixed = costs.reduce((s, c) => s + c.cost_fixed, 0)
        const totalDuration = costs.reduce((s, c) => s + c.actiontime, 0)
        const total = totalTime + totalFixed
        return (
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #d0d7e1',
            padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.04)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
              <i className="bi bi-cash-stack" style={{ marginRight: 8, color: '#4f46e5' }} />
              Coûts d'intervention
            </h2>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Coût temps total', value: fmt(totalTime), icon: 'bi-clock', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
                { label: 'Coût fixe total', value: fmt(totalFixed), icon: 'bi-receipt', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
                { label: 'Coût total', value: fmt(total), icon: 'bi-wallet2', bg: '#eef2ff', border: '#c7d2fe', color: '#4338ca' },
              ].map(card => (
                <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: card.color, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className={`bi ${card.icon}`} />{card.label}
                  </p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: card.color, margin: 0 }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Duration summary */}
            <div style={{ background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="bi bi-hourglass-split" style={{ color: '#6366f1' }} />
              Durée totale d'intervention : <strong style={{ color: '#1e293b', marginLeft: 4 }}>{fmtDuration(totalDuration)}</strong>
            </div>

            {/* Detail table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    {['Libellé', 'Date début', 'Durée', 'Coût temps', 'Coût fixe', 'Sous-total'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Libellé' || h === 'Date début' ? 'left' : 'right', fontWeight: 600, color: '#64748b', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: 500 }}>{c.name}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{c.begin_date ?? '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>{fmtDuration(c.actiontime)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#1d4ed8', fontWeight: 500 }}>{fmt(c.cost_time)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#15803d', fontWeight: 500 }}>{fmt(c.cost_fixed)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#4338ca', fontWeight: 700 }}>{fmt(c.cost_time * (c.actiontime / 3600) + c.cost_fixed)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#eef2ff', borderTop: '2px solid #c7d2fe' }}>
                    <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, color: '#4338ca', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Total</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#4338ca' }}>{fmtDuration(totalDuration)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#4338ca' }}>{fmt(totalTime)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#4338ca' }}>{fmt(totalFixed)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#4338ca', fontSize: 15 }}>{fmt(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
