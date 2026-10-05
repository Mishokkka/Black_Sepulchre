import { AlertTriangle, CheckCircle2, Info, LockKeyhole } from 'lucide-react'
export function StatusBadge({
  children,
  tone = 'info',
}: {
  children: React.ReactNode
  tone?: 'ready' | 'warning' | 'danger' | 'info'
}) {
  const Icon =
    tone === 'ready'
      ? CheckCircle2
      : tone === 'warning'
        ? AlertTriangle
        : tone === 'danger'
          ? LockKeyhole
          : Info
  return (
    <span className={`status-badge tone-${tone}`}>
      <Icon size={12} aria-hidden="true" />
      {children}
    </span>
  )
}
