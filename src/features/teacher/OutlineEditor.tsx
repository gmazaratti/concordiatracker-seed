import { Plus, Trash2 } from 'lucide-react'
import { KIND_LABEL } from '@/lib/assessment'
import { daysFromNow } from '@/lib/date'
import { outlineWeight, uid, type OutlineItem } from '@/data/teacher'
import { Select } from '@/components/ui/Select'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { cn } from '@/lib/cn'

const KIND_OPTIONS = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))
const inputCls =
  'w-full rounded-md border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

function clampWeight(v: string): number {
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)))
}

/** The editable course outline — kind, title, due, weight per row, with a running
 * weight total. The same model a published outline becomes the verified blueprint. */
export function OutlineEditor({
  items,
  onChange,
}: {
  items: OutlineItem[]
  onChange: (items: OutlineItem[]) => void
}) {
  const total = outlineWeight(items)

  const update = (id: string, patch: Partial<OutlineItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  const remove = (id: string) => onChange(items.filter((it) => it.id !== id))
  const add = () =>
    onChange([
      ...items,
      { id: uid('oi'), kind: 'assignment', title: '', due: daysFromNow(14, 23, 59), weight: 0 },
    ])

  return (
    <div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong bg-surface/50 px-4 py-6 text-center text-[13px] text-subtle">
          No assessments yet — add your first, or upload a syllabus to parse it.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="hidden gap-2 px-1 text-[11px] font-semibold tracking-wide text-subtle uppercase sm:flex">
            <span className="w-32">Type</span>
            <span className="flex-1">Title</span>
            <span className="w-44">Due</span>
            <span className="w-24 text-right">Weight</span>
            <span className="w-8" />
          </div>

          {items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-1"
            >
              <div className="sm:w-32">
                <Select
                  size="sm"
                  tone="control"
                  ariaLabel="Assessment type"
                  value={it.kind}
                  onChange={(v) => update(it.id, { kind: v as OutlineItem['kind'] })}
                  options={KIND_OPTIONS}
                />
              </div>
              <input
                value={it.title}
                onChange={(e) => update(it.id, { title: e.target.value })}
                placeholder="Assessment title"
                aria-label="Assessment title"
                className={cn(inputCls, 'flex-1')}
              />
              <div className="sm:w-44">
                <DateTimePicker
                  ariaLabel="Due date"
                  value={it.due}
                  onChange={(v) => update(it.id, { due: v })}
                />
              </div>
              <div className="flex items-center gap-1.5 sm:w-24 sm:justify-end">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={it.weight}
                  onChange={(e) => update(it.id, { weight: clampWeight(e.target.value) })}
                  aria-label="Weight percent"
                  className={cn(inputCls, 'w-16 text-right')}
                />
                <span className="text-[12px] text-subtle">%</span>
              </div>
              <button
                type="button"
                onClick={() => remove(it.id)}
                aria-label={`Remove ${it.title || 'assessment'}`}
                className="grid size-8 shrink-0 place-items-center self-end rounded-md text-subtle transition-colors duration-150 hover:bg-danger/10 hover:text-danger sm:self-center"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:text-accent"
        >
          <Plus size={15} aria-hidden />
          Add assessment
        </button>
        <span
          className={cn(
            'text-[13px] font-medium tabular-nums',
            total === 100 ? 'text-success' : 'text-warning',
          )}
        >
          Total weight: {total}%{total !== 100 && ' — should be 100%'}
        </span>
      </div>
    </div>
  )
}
