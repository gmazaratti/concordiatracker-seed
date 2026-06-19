import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Loader2, RefreshCw, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

/** A titled panel — the standard container for a tab's content block. */
export function Panel({
  title,
  sub,
  action,
  children,
}: {
  title: string
  sub?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
          {sub && <p className="mt-0.5 text-[12px] text-subtle">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** Monospace value with click-to-copy (for user ids, vanity codes, links). */
export function CopyChip({ value, title }: { value: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (
    <button
      type="button"
      title={title ?? 'Copy'}
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 1200)
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:text-fg"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check size={11} className="shrink-0 text-success" aria-hidden />
      ) : (
        <Copy size={11} className="shrink-0 opacity-60" aria-hidden />
      )}
    </button>
  )
}

const TONES: Record<string, string> = {
  green: 'bg-success/15 text-success',
  amber: 'bg-warning/15 text-warning',
  red: 'bg-danger/15 text-danger',
  blue: 'bg-info/15 text-info',
  neutral: 'bg-surface-2 text-subtle',
}
export function Pill({ tone = 'neutral', children }: { tone?: keyof typeof TONES | string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', TONES[tone] ?? TONES.neutral)}>
      {children}
    </span>
  )
}

/** Search input row used at the top of list tabs. */
export function SearchBar({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-surface-2 py-2 pr-3 pl-9 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
      </div>
      {children}
    </div>
  )
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
    >
      <RefreshCw size={13} className={cn(busy && 'animate-spin')} aria-hidden />
      Refresh
    </button>
  )
}

/** Two-click confirm — first click arms, second within 3s commits. For destructive actions. */
export function ConfirmButton({
  label,
  armedLabel = 'Click to confirm',
  onConfirm,
  danger,
  disabled,
}: {
  label: string
  armedLabel?: string
  onConfirm: () => void
  danger?: boolean
  disabled?: boolean
}) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!armed) {
          setArmed(true)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => setArmed(false), 3000)
        } else {
          if (timer.current) clearTimeout(timer.current)
          setArmed(false)
          onConfirm()
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
        armed
          ? 'border-danger bg-danger/10 text-danger'
          : danger
            ? 'border-border text-danger hover:bg-danger/10'
            : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      {armed ? armedLabel : label}
    </button>
  )
}

export function Loading() {
  return (
    <div className="grid place-items-center py-16">
      <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-[13px] text-subtle">{children}</p>
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p className="px-4 py-6 text-center text-[13px] text-danger">
      {message}
    </p>
  )
}
