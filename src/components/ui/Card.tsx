import { cn } from '@/lib/cn'

/** Neutral surface container — the calm building block for panels and lists. */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface',
        className,
      )}
      {...props}
    />
  )
}
