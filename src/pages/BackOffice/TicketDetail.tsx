import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GLPI_BASE_URL, GLPI_APP_TOKEN } from '@/api/glpi';
import { sessionTokenFromFile } from '@/lib/sessionToken';
import './TicketDetail.css';

// Reuse GLPI status mapping
const GLPI_STATUS: Record<number, { label: string, className: string }> = {
  1: { label: 'NEW', className: 'status-new' },
  2: { label: 'IN PROGRESS', className: 'status-progress' },
  3: { label: 'PLANNED', className: 'status-progress' },
  4: { label: 'PENDING', className: 'status-progress' },
  5: { label: 'SOLVED', className: 'status-resolved' },
  6: { label: 'CLOSED', className: 'status-resolved' },
};

export const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    if (id) fetchTicketDetail(id);
  }, [id]);

  const fetchTicketDetail = async (ticketId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const sessionToken = localStorage.getItem('glpi_session_token') || sessionTokenFromFile;
      
      const response = await fetch(`${GLPI_BASE_URL}/apirest.php/Ticket/${ticketId}?expand_dropdowns=true`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'App-Token': GLPI_APP_TOKEN,
          'Session-Token': sessionToken,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ticket: ${response.status}`);
      }

      const data = await response.json();
      setTicket(data);
    } catch (err: any) {
      console.error('Failed to fetch ticket details:', err);
      setError(err.message || 'Error loading ticket details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="ticket-detail-page"><div style={{ padding: '40px', textAlign: 'center' }}>Loading ticket details...</div></div>;
  }

  if (error || !ticket) {
    return (
      <div className="ticket-detail-page">
        <div className="breadcrumb">
          <span onClick={() => navigate('/admin/tickets')}>Tickets</span> 
          <i className="bi bi-chevron-right"></i>
          <span className="current">Error</span>
        </div>
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
          {error || 'Ticket not found.'}
        </div>
      </div>
    );
  }

  const statusInfo = GLPI_STATUS[ticket.status] || { label: 'UNKNOWN', className: '' };

  return (
    <div className="ticket-detail-page">
      <div className="breadcrumb">
        <span onClick={() => navigate('/admin/tickets')}>Tickets</span> 
        <i className="bi bi-chevron-right"></i>
        <span className="current">#{ticket.id}</span>
      </div>

      <div className="ticket-header-glass">
        <div className="header-main">
          <div className="title-section">
            <span className="ticket-label">Ticket title</span>
            <h1>{ticket.name || '(No title)'} <span>(#{ticket.id})</span></h1>
          </div>
          <div className="status-section">
            <div className="status-item">
              <span className="ticket-label">Status</span>
              <span className={`badge-progress ${statusInfo.className}`} style={{ background: 'var(--blue)' }}>
                <span className="dot"></span> {statusInfo.label}
              </span>
            </div>
            <div className="status-item">
              <span className="ticket-label">Date Created</span>
              <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                {ticket.date_creation || '-'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ticket-content-split">
        {/* Sidebar */}
        <div className="sidebar-glass">
          <h3>Ticket Info</h3>
          
          <div className="sidebar-section">
            <h4>Content</h4>
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
               <div dangerouslySetInnerHTML={{ __html: ticket.content || 'No content provided.' }} />
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Requester ID</h4>
            <div className="actor-card">
              <div className="avatar">R</div>
              <div className="actor-info">
                <span className="name">{ticket.users_id_recipient || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Assigned Tech ID</h4>
            <div className="actor-card">
              <div className="avatar bg-purple">T</div>
              <div className="actor-info">
                <span className="name">{ticket.users_id_assign || 'Unassigned'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Timeline */}
        <div className="timeline-glass">
          <div className="timeline-feed">
            
            {/* Timeline Item 1 - Creation */}
            <div className="timeline-item">
              <div className="timeline-time">
                <span className="time">{ticket.date_creation?.split(' ')[1]?.substring(0,5)}</span>
              </div>
              <div className="timeline-marker">
                <div className="avatar-small">R</div>
                <div className="line"></div>
              </div>
              <div className="timeline-content">
                <div className="content-header">
                  <strong>Ticket Created</strong>
                </div>
                <div className="content-body">
                  Initial request submitted
                </div>
              </div>
            </div>

            {/* Note: In a full GLPI integration, you would fetch /Ticket/{id}/ITILFollowup and /TicketTask etc. to populate this timeline. */}
            <div className="timeline-item">
              <div className="timeline-marker">
                 <div className="icon-small bg-blue"><i className="bi bi-info"></i></div>
                 <div className="line"></div>
              </div>
              <div className="timeline-content">
                 <div className="content-body" style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                    Note: Full timeline (follow-ups, tasks, documents) requires fetching additional GLPI sub-endpoints (e.g. /Ticket/{ticket.id}/ITILFollowup).
                 </div>
              </div>
            </div>

          </div>

          {/* Reply Box */}
          <div className="reply-box">
            <div className="reply-toolbar">
              <button><i className="bi bi-type-bold"></i></button>
              <button><i className="bi bi-type-italic"></i></button>
              <button><i className="bi bi-type-underline"></i></button>
              <span className="divider"></span>
              <button><i className="bi bi-paperclip"></i></button>
              <button><i className="bi bi-link-45deg"></i></button>
            </div>
            <textarea 
              placeholder="Write a reply or solution..." 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            ></textarea>
            <div className="reply-footer">
              <div className="reply-tabs">
                <span className="active">Reply</span>
                <span>Note</span>
                <span>Resolution</span>
              </div>
              <button className="btn-send">Send Reply</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
