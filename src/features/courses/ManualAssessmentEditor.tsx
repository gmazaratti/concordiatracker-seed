import { Plus, ShieldQuestion, Trash2 } from 'lucide-react'
import type { Assessment, AssessmentKind } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { KIND_LABEL } from '@/lib/assessment'
import { cn } from '@/lib/cn'

const KIND_OPTIONS = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))
const inputCls =
  'w-full rounded-md border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

function clampWeight(v: string): number {
  return Math.max(0, Math.min(100, Math.round(Number(v) || 0)))
}

/** The manual assessment list — the same kind/title/due/weight row model the parse
 * and blueprint flows produce, but filled by hand. Add/edit/remove with a running
 * weight total. Every date is SELF-ENTERED → lands as `unverified` provenance, so
 * the page is honest about where it came from. Writes straight to the store. */
export function ManualAssessmentEditor({ courseId }: { courseId: string }) {
  const { assessments, addBlankAssessment, updateAssessment, removeAssessment } = useAppData()
  const rows = assessments.filter((a) => a.courseId === courseId)
  const total = rows.reduce((sum, a) => sum + (Number.isFinite(a.weight) ? a.weight : 0), 0)

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-fg">Assessments</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-prov-unverified" title="Dates you enter are self-entered — unverified until classmates corroborate them.">
          <ShieldQuestion size={13} aria-hidden />
          Self-entered · unverified
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong bg-surface/50 px-4 py-8 text-center text-[13px] text-subtle">
          No assessments yet — add your first below, then fill in the dates and weights.
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

          {rows.map((a) => (
            <Row key={a.id} assessment={a} onPatch={updateAssessment} onRemove={removeAssessment} />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => addBlankAssessment(courseId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:text-accent"
        >
          <Plus size={15} aria-hidden />
          Add assessment
        </button>
        {rows.length > 0 && (
          <span
            className={cn(
              'text-[13px] font-medium tabular-nums',
              total === 100 ? 'text-success' : 'text-warning',
            )}
          >
            Total weight: {total}%{total !== 100 && ' — should be 100%'}
          </span>
        )}
      </div>
    </Card>
  )
}

function Row({
  assessment,
  onPatch,
  onRemove,
}: {
  assessment: Assessment
  onPatch: (id: string, patch: Partial<Assessment>) => void
  onRemove: (id: string) => void
}) {
  const a = assessment
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 sm:flex-row sm:items-center sm:border-0 sm:bg-transparent sm:p-1">
      <div className="sm:w-32">
        <Select
          size="sm"
          tone="control"
          ariaLabel="Assessment type"
          value={a.kind}
          onChange={(v) => onPatch(a.id, { kind: v as AssessmentKind })}
          options={KIND_OPTIONS}
        />
      </div>
      <input
        value={a.title}
        onChange={(e) => onPatch(a.id, { title: e.target.value })}
        placeholder="Assessment title"
        aria-label="Assessment title"
        className={cn(inputCls, 'flex-1')}
      />
      <div className="sm:w-44">
        <DateTimePicker
          ariaLabel="Due date"
          value={a.due}
          onChange={(v) => onPatch(a.id, { due: v })}
        />
      </div>
      <div className="flex items-center gap-1.5 sm:w-24 sm:justify-end">
        <input
          type="number"
          min={0}
          max={100}
          value={a.weight}
          onChange={(e) => onPatch(a.id, { weight: clampWeight(e.target.value) })}
          aria-label="Weight percent"
          className={cn(inputCls, 'w-16 text-right')}
        />
        <span className="text-[12px] text-subtle">%</span>
      </div>
      <button
        type="button"
        onClick={() => onRemove(a.id)}
        aria-label={`Remove ${a.title || 'assessment'}`}
        className="grid size-8 shrink-0 place-items-center self-end rounded-md text-subtle transition-colors duration-150 hover:bg-danger/10 hover:text-danger sm:self-center"
      >
        <Trash2 size={15} aria-hidden />
      </button>
    </div>
  )
}
