import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listItems } from '@/api/glpi';
import './TicketsList.css';

// GLPI status mapping
const GLPI_STATUS: Record<number, { label: string, className: string }> = {
  1: { label: 'NEW', className: 'status-new' },
  2: { label: 'IN PROGRESS', className: 'status-progress' },
  3: { label: 'PLANNED', className: 'status-progress' },
  4: { label: 'PENDING', className: 'status-progress' },
  5: { label: 'SOLVED', className: 'status-resolved' },
  6: { label: 'CLOSED', className: 'status-resolved' },
};

// GLPI priority mapping
const GLPI_PRIORITY: Record<number, { label: string, icon: React.ReactNode }> = {
  1: { label: 'VERY LOW', icon: <span className="priority-low"><i className="bi bi-arrow-down-right"></i> VERY LOW</span> },
  2: { label: 'LOW', icon: <span className="priority-low"><i className="bi bi-arrow-down-right"></i> LOW</span> },
  3: { label: 'MEDIUM', icon: <span className="priority-medium"><i className="bi bi-dash"></i> MEDIUM</span> },
  4: { label: 'HIGH', icon: <span className="priority-high"><i className="bi bi-arrow-up-right"></i> HIGH</span> },
  5: { label: 'VERY HIGH', icon: <span className="priority-high"><i className="bi bi-arrow-up-right"></i> VERY HIGH</span> },
  6: { label: 'MAJOR', icon: <span className="priority-high"><i className="bi bi-exclamation-triangle"></i> MAJOR</span> },
};

export const TicketsList: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listItems('Ticket');
      setTickets(data);
    } catch (err: any) {
      console.error('Failed to fetch tickets:', err);
      setError(err.message || 'Une erreur est survenue lors de la récupération des tickets.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTickets.size === tickets.length && tickets.length > 0) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(tickets.map(t => t.id)));
    }
  };

  const toggleTicket = (id: number) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTickets(newSelected);
  };

  return (
    <div className="tickets-page">
      <div className="tickets-header">
        <div className="header-titles">
          <h1>Helpdesk</h1>
          <p>Manage all IT support requests and issues {tickets.length > 0 && `(Total: ${tickets.length})`}</p>
        </div>
        <button className="btn-primary">New Ticket</button>
      </div>

      <div className="tickets-toolbar">
        <div className="search-bar">
          <i className="bi bi-search"></i>
          <input type="text" placeholder="Search tickets (ID, title, requester)..." />
        </div>
        <div className="filters">
          <button className="filter-btn">Status <i className="bi bi-chevron-down"></i></button>
          <button className="filter-btn">Priority <i className="bi bi-chevron-down"></i></button>
          <button className="filter-btn">Category <i className="bi bi-chevron-down"></i></button>
          <button className="filter-btn">Assigned Tech <i className="bi bi-chevron-down"></i></button>
          <button className="filter-btn">Date Range <i className="bi bi-chevron-down"></i></button>
        </div>
      </div>

      <div className="tickets-mass-actions">
        <div className="selection-info">
          <input 
            type="checkbox" 
            checked={selectedTickets.size > 0 && selectedTickets.size === tickets.length}
            ref={input => {
              if (input) {
                input.indeterminate = selectedTickets.size > 0 && selectedTickets.size < tickets.length;
              }
            }}
            onChange={toggleSelectAll} 
            disabled={tickets.length === 0}
          />
          <span>({selectedTickets.size} tickets selected)</span>
        </div>
        <div className="action-buttons">
          <button className="action-btn" disabled={selectedTickets.size === 0}><i className="bi bi-person-plus"></i> Assign</button>
          <button className="action-btn" disabled={selectedTickets.size === 0}><i className="bi bi-arrow-repeat"></i> Change Status</button>
          <button className="action-btn" disabled={selectedTickets.size === 0}><i className="bi bi-check-circle"></i> Close</button>
        </div>
        <div className="action-buttons-right">
          <button className="action-btn"><i className="bi bi-download"></i> Export</button>
          <button className="action-btn" onClick={fetchTickets}><i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh</button>
        </div>
      </div>

      <div className="tickets-table-container">
        {error && <div style={{ padding: '20px', color: '#ef4444', textAlign: 'center' }}>{error}</div>}
        
        {!error && (
          <table className="tickets-table">
            <thead>
              <tr>
                <th></th>
                <th>ID <i className="bi bi-arrow-down-up"></i></th>
                <th>Status <i className="bi bi-arrow-down-up"></i></th>
                <th>Date (Created) <i className="bi bi-arrow-down-up"></i></th>
                <th>Priority <i className="bi bi-arrow-down-up"></i></th>
                <th>Requester</th>
                <th>Title <i className="bi bi-arrow-down-up"></i></th>
                <th>Category <i className="bi bi-arrow-down-up"></i></th>
                <th>Assigned Tech <i className="bi bi-arrow-down-up"></i></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && tickets.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}>Loading tickets...</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}>No tickets found.</td>
                </tr>
              ) : (
                tickets.map(ticket => {
                  const statusInfo = GLPI_STATUS[ticket.status] || { label: `UNKNOWN (${ticket.status})`, className: '' };
                  const priorityInfo = GLPI_PRIORITY[ticket.priority] || { label: `UNKNOWN`, icon: null };
                  
                  return (
                    <tr key={ticket.id} className={selectedTickets.has(ticket.id) ? 'selected' : ''}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedTickets.has(ticket.id)} 
                          onChange={() => toggleTicket(ticket.id)} 
                        />
                      </td>
                      <td className="ticket-id" onClick={() => navigate(`/admin/tickets/${ticket.id}`)}>
                        #{ticket.id}
                      </td>
                      <td>
                        <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>
                      </td>
                      <td className="ticket-date">{ticket.date_creation || '-'}</td>
                      <td>{priorityInfo.icon}</td>
                      <td className="ticket-requester">
                        {/* GLPI requester usually needs an extra expand call or parsing links, using ID or fallback for now */}
                        {ticket.users_id_recipient || '-'}
                      </td>
                      <td className="ticket-title" onClick={() => navigate(`/admin/tickets/${ticket.id}`)}>
                        {ticket.name || '(No title)'}
                      </td>
                      <td className="ticket-category">{ticket.itilcategories_id || '-'}</td>
                      <td className="ticket-tech">{ticket.users_id_assign || '-'}</td>
                      <td className="ticket-actions">
                        <button className="icon-btn" title="View" onClick={() => navigate(`/admin/tickets/${ticket.id}`)}><i className="bi bi-eye"></i></button>
                        <button className="icon-btn" title="Edit"><i className="bi bi-pencil"></i></button>
                        <button className="icon-btn text-danger" title="Delete"><i className="bi bi-trash"></i></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="tickets-pagination">
        <span>{tickets.length > 0 ? `1-${tickets.length} of ${tickets.length}` : '0 of 0'}</span>
        <button className="page-btn"><i className="bi bi-chevron-left"></i></button>
        <button className="page-btn"><i className="bi bi-chevron-right"></i></button>
      </div>
    </div>
  );
};
