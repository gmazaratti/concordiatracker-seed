import { useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/cn'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** A user avatar — the Google profile picture when present, else initials.
 * (`referrerPolicy=no-referrer` keeps Google's lh3 URLs from 403-ing.) */
export function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const sizeCls = size === 'sm' ? 'size-7' : size === 'lg' ? 'size-10' : 'size-8'
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full bg-surface-2 object-cover', sizeCls)}
      />
    )
  }
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent',
        sizeCls,
        size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-[13px]' : 'text-[11px]',
      )}
    >
      {initials(name)}
    </span>
  )
}

/** Subtle "verified Concordia member" check next to author names (matches the
 * reference's checkmark). Decorative. */
export function VerifiedCheck() {
  return <BadgeCheck size={14} className="shrink-0 text-info" aria-label="Verified" />
}

/** Admin-reply badge — set server-side (is_staff), so only real admins get it. */
export function StaffBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
      Admin
    </span>
  )
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g
function renderInline(text: string, base: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(<strong key={`${base}-${i}`}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('~~')) out.push(<s key={`${base}-${i}`}>{tok.slice(2, -2)}</s>)
    else out.push(<em key={`${base}-${i}`}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
    i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Lightweight, XSS-safe markdown: **bold**, *italic*, ~~strike~~, line breaks. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <div className={className}>
      {lines.map((line, idx) => (
        <span key={idx}>
          {renderInline(line, String(idx))}
          {idx < lines.length - 1 && <br />}
        </span>
      ))}
    </div>
  )
}

export function TierChip({ tier }: { tier: string }) {
  const pro = tier === 'pro'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        pro ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-subtle',
      )}
    >
      {pro ? 'Pro' : 'Free'}
    </span>
  )
}

const REQ_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-surface-2 text-subtle' },
  planned: { label: 'Planned', cls: 'bg-info/15 text-info' },
  'in-progress': { label: 'In progress', cls: 'bg-accent-soft text-accent' },
  shipped: { label: 'Shipped', cls: 'bg-success/15 text-success' },
  declined: { label: 'Declined', cls: 'bg-surface-2 text-muted' },
}
export function RequestStatusChip({ status }: { status: string }) {
  const s = REQ_STATUS[status] ?? REQ_STATUS.open
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', s.cls)}>{s.label}</span>
}

export function KnownIssueChip({ status }: { status: string }) {
  const fixed = status === 'resolved'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        fixed ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
      )}
    >
      {fixed ? 'Fixed' : 'Known issue'}
    </span>
  )
}

