type Variant = 'open' | 'closed' | 'pending' | 'high' | 'medium' | 'low' | 'incident' | 'request'

const styles: Record<Variant, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-200 text-slate-700',
  pending: 'bg-amber-100 text-amber-700',
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-sky-100 text-sky-700',
  low: 'bg-violet-100 text-violet-700',
  incident: 'bg-rose-100 text-rose-700',
  request: 'bg-cyan-100 text-cyan-700',
}

export const StatusBadge = ({ label, variant }: { label: string; variant: Variant }) => (
  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${styles[variant]}`}>
    {label}
  </span>
)
