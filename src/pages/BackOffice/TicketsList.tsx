import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './TicketsList.css';

const MOCK_TICKETS = [
  { id: '#10432', status: 'NEW', date: '26 Oct 2023 10:15', priority: 'HIGH', requester: 'David Chen (IT Dept.)', title: 'Network Outage - Server Room 3', category: 'Infrastructure > Network', tech: 'Sarah Miller' },
  { id: '#10431', status: 'IN PROGRESS', date: '26 Oct 2023 09:42', priority: 'MEDIUM', requester: 'Maria Garcia', title: 'VPN Access issue for remote team', category: 'Hardware > Software', tech: 'Alex Thompson' },
  { id: '#10430', status: 'RESOLVED', date: '26 Oct 2023 08:30', priority: 'LOW', requester: 'James Wilson', title: 'Printer setup - Marketing Floor 4', category: 'Hardware > Peripheral', tech: 'Michael Brown' },
];

export const TicketsList: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedTickets.size === MOCK_TICKETS.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(MOCK_TICKETS.map(t => t.id)));
    }
  };

  const toggleTicket = (id: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTickets(newSelected);
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'NEW': return 'status-new';
      case 'IN PROGRESS': return 'status-progress';
      case 'RESOLVED': return 'status-resolved';
      default: return '';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'HIGH': return <span className="priority-high"><i className="bi bi-arrow-up-right"></i> HIGH</span>;
      case 'MEDIUM': return <span className="priority-medium"><i className="bi bi-dash"></i> MEDIUM</span>;
      case 'LOW': return <span className="priority-low"><i className="bi bi-arrow-down-right"></i> LOW</span>;
      default: return null;
    }
  };

  return (
    <div className="tickets-page">
      <div className="tickets-header">
        <div className="header-titles">
          <h1>Helpdesk</h1>
          <p>Manage all IT support requests and issues (Total: 1,429)</p>
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
            checked={selectedTickets.size > 0 && selectedTickets.size === MOCK_TICKETS.length}
            ref={input => {
              if (input) {
                input.indeterminate = selectedTickets.size > 0 && selectedTickets.size < MOCK_TICKETS.length;
              }
            }}
            onChange={toggleSelectAll} 
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
          <button className="action-btn"><i className="bi bi-arrow-clockwise"></i> Refresh</button>
        </div>
      </div>

      <div className="tickets-table-container">
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
            {MOCK_TICKETS.map(ticket => (
              <tr key={ticket.id} className={selectedTickets.has(ticket.id) ? 'selected' : ''}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedTickets.has(ticket.id)} 
                    onChange={() => toggleTicket(ticket.id)} 
                  />
                </td>
                <td className="ticket-id" onClick={() => navigate(`/admin/tickets/${ticket.id.substring(1)}`)}>
                  {ticket.id}
                </td>
                <td>
                  <span className={`status-badge ${getStatusClass(ticket.status)}`}>{ticket.status}</span>
                </td>
                <td className="ticket-date">{ticket.date}</td>
                <td>{getPriorityIcon(ticket.priority)}</td>
                <td className="ticket-requester">{ticket.requester}</td>
                <td className="ticket-title" onClick={() => navigate(`/admin/tickets/${ticket.id.substring(1)}`)}>
                  {ticket.title}
                </td>
                <td className="ticket-category">{ticket.category}</td>
                <td className="ticket-tech">{ticket.tech}</td>
                <td className="ticket-actions">
                  <button className="icon-btn" title="View" onClick={() => navigate(`/admin/tickets/${ticket.id.substring(1)}`)}><i className="bi bi-eye"></i></button>
                  <button className="icon-btn" title="Edit"><i className="bi bi-pencil"></i></button>
                  <button className="icon-btn text-danger" title="Delete"><i className="bi bi-trash"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="tickets-pagination">
        <span>1-10 of 1,429</span>
        <button className="page-btn"><i className="bi bi-chevron-left"></i></button>
        <button className="page-btn"><i className="bi bi-chevron-right"></i></button>
      </div>
    </div>
  );
};
