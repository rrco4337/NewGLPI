import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './TicketDetail.css';

export const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState('');

  return (
    <div className="ticket-detail-page">
      <div className="breadcrumb">
        <span onClick={() => navigate('/admin/tickets')}>Tickets</span> 
        <i className="bi bi-chevron-right"></i>
        <span className="current">#{id || '14589'}</span>
      </div>

      <div className="ticket-header-glass">
        <div className="header-main">
          <div className="title-section">
            <span className="ticket-label">Ticket title</span>
            <h1>Network Issue: Slow Wi-Fi in Conference Room (CR-201) <span>(#{id || '14589'})</span></h1>
          </div>
          <div className="status-section">
            <div className="status-item">
              <span className="ticket-label">Status</span>
              <span className="badge-progress"><span className="dot"></span> In Progress</span>
            </div>
            <div className="status-item">
              <span className="ticket-label">SLA / TTO</span>
              <div className="sla-progress">
                <div className="sla-bar"><div className="sla-fill" style={{ width: '75%' }}></div></div>
                <span className="sla-text">SLA 75% remaining</span>
              </div>
              <div className="tto-status"><i className="bi bi-check-circle-fill"></i> TTO met</div>
            </div>
          </div>
        </div>
      </div>

      <div className="ticket-content-split">
        {/* Sidebar */}
        <div className="sidebar-glass">
          <h3>Actors & Assets</h3>
          
          <div className="sidebar-section">
            <h4>Requester</h4>
            <div className="actor-card">
              <div className="avatar">AT</div>
              <div className="actor-info">
                <span className="name">Alex Thompson</span>
                <span className="email">alex.t@email.com</span>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Observers</h4>
            <div className="actor-card">
              <div className="avatar bg-green">LG</div>
              <div className="actor-info">
                <span className="name">Lisa Green</span>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <h4>Assigned Tech</h4>
            <div className="actor-card">
              <div className="avatar bg-purple">SJ</div>
              <div className="actor-info">
                <span className="name">Sarah Jenkins</span>
                <span className="email">sarah.j@email.com</span>
                <span className="role">L2 Network Specialist</span>
              </div>
            </div>
          </div>

          <div className="sidebar-divider"></div>

          <div className="sidebar-section">
            <h4>Linked Assets</h4>
            <div className="asset-card">
              <i className="bi bi-laptop asset-icon"></i>
              <div className="asset-info">
                <span className="name">MacBook Pro 16"</span>
                <span className="id">#AST-9812</span>
              </div>
            </div>
            <div className="asset-card">
              <i className="bi bi-router asset-icon"></i>
              <div className="asset-info">
                <span className="name">Cisco AP</span>
                <span className="id">#AP-401</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Timeline */}
        <div className="timeline-glass">
          <div className="timeline-feed">
            
            {/* Timeline Item 1 */}
            <div className="timeline-item">
              <div className="timeline-time">
                <span className="date">Oct 26,</span>
                <span className="time">14:15</span>
              </div>
              <div className="timeline-marker">
                <div className="avatar-small">AT</div>
                <div className="line"></div>
              </div>
              <div className="timeline-content">
                <div className="content-header">
                  <strong>Alex Thompson</strong> created ticket
                </div>
                <div className="content-body">
                  New, priority <span className="text-high">High</span>
                </div>
              </div>
            </div>

            {/* Timeline Item 2 */}
            <div className="timeline-item system">
              <div className="timeline-time">
                <span className="time">14:20</span>
              </div>
              <div className="timeline-marker">
                <div className="icon-small bg-blue"><i className="bi bi-arrow-repeat"></i></div>
                <div className="line"></div>
              </div>
              <div className="timeline-content">
                <div className="content-body">
                  Automatic assignment to Sarah Jenkins
                </div>
              </div>
            </div>

            {/* Timeline Item 3 */}
            <div className="timeline-item internal">
              <div className="timeline-time">
                <span className="time">14:45</span>
              </div>
              <div className="timeline-marker">
                <div className="avatar-small bg-purple">SJ</div>
                <div className="line"></div>
              </div>
              <div className="timeline-content">
                <div className="content-header">
                  <strong>Sarah Jenkins</strong> (Internal Note)
                  <i className="bi bi-three-dots"></i>
                </div>
                <div className="content-body">
                  Investigated AP configuration (15 mins spent)
                </div>
              </div>
            </div>

            {/* Timeline Item 4 */}
            <div className="timeline-item">
              <div className="timeline-time">
                <span className="time">15:10</span>
              </div>
              <div className="timeline-marker">
                <div className="avatar-small">AT</div>
                <div className="line"></div>
              </div>
              <div className="timeline-content">
                <div className="content-header">
                  <strong>Alex Thompson</strong> (Follow-up)
                  <i className="bi bi-three-dots"></i>
                </div>
                <div className="content-body">
                  Network test results
                  <div className="attachment">
                    <i className="bi bi-file-earmark-pdf-fill text-red"></i>
                    <span>test_results.pdf</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Item 5 */}
            <div className="timeline-item internal">
              <div className="timeline-time">
                <span className="time">15:30</span>
              </div>
              <div className="timeline-marker">
                <div className="avatar-small bg-purple">SJ</div>
                <div className="line"></div>
              </div>
              <div className="timeline-content">
                <div className="content-header">
                  <strong>Sarah Jenkins</strong> (Internal Task)
                  <i className="bi bi-three-dots"></i>
                </div>
                <div className="content-body">
                  Firmware Update (30 mins spent)
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
