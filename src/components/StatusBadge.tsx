import './StatusBadge.css'

type Variant = 'open' | 'closed' | 'pending' | 'high' | 'medium' | 'low' | 'incident' | 'request'

export const StatusBadge = ({ label, variant }: { label: string; variant: Variant }) => (
  <span className={`sb-badge sb-${variant}`}>{label}</span>
)
