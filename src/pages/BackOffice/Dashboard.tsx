import './Dashboard.css'

export const Dashboard = () => {
  return (
    <div className="dashboard-overview">
      <div className="overview-header">
        <h1>Overview</h1>
        <p>Welcome back! Here's a summary of your GLPI inventory.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon computers">💻</div>
          <div className="stat-info">
            <span className="stat-value">1,248</span>
            <span className="stat-label">Total Computers</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon users">👥</div>
          <div className="stat-info">
            <span className="stat-value">842</span>
            <span className="stat-label">Active Users</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tickets">🎫</div>
          <div className="stat-info">
            <span className="stat-value">56</span>
            <span className="stat-label">Open Tickets</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon alerts">⚠️</div>
          <div className="stat-info">
            <span className="stat-value">12</span>
            <span className="stat-label">System Alerts</span>
          </div>
        </div>
      </div>

      <div className="recent-activity-section">
        <h2>Recent Activity</h2>
        <div className="activity-list">
          <div className="activity-item">
            <div className="activity-dot new"></div>
            <div className="activity-content">
              <strong>New Computer added</strong>
              <span>MacBook Pro 16" (SN: C02Y23899) assigned to Alice</span>
            </div>
            <div className="activity-time">2 hours ago</div>
          </div>
          
          <div className="activity-item">
            <div className="activity-dot update"></div>
            <div className="activity-content">
              <strong>Ticket Resolved</strong>
              <span>Network connectivity issues on Floor 3</span>
            </div>
            <div className="activity-time">5 hours ago</div>
          </div>
          
          <div className="activity-item">
            <div className="activity-dot new"></div>
            <div className="activity-content">
              <strong>New User created</strong>
              <span>Bob Smith joined the IT Support group</span>
            </div>
            <div className="activity-time">1 day ago</div>
          </div>
        </div>
      </div>
    </div>
  )
}
