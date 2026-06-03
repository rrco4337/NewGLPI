import type { AsyncState } from '@/types/glpi'

type StatusMessageProps = {
  state: AsyncState
  message: string | null
  className?: string
}

export function StatusMessage({ state, message, className }: StatusMessageProps) {
  if (!message) return null

  return (
    <div
      className={`status-message ${state}${className ? ` ${className}` : ''}`}
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
