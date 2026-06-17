import { useEffect, useState } from 'react'
import type { Assessment } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { AssessmentRow } from './AssessmentRow'

type Tab = 'grades' | 'notes'

const byDue = (a: Assessment, b: Assessment) =>
  new Date(a.due).getTime() - new Date(b.due).getTime()

/** The course's full assessment list, in due order. Two views over the same
 * rows: Grades (the status + grade editor) and Notes (per-assessment notes).
 * The shared model means both write straight to the store. `focusId` (set by
 * "Open in course") scrolls that row into view and glows it briefly. */
export function AssessmentTable({
  assessments,
  focusId,
}: {
  assessments: Assessment[]
  focusId?: string
}) {
  const [tab, setTab] = useState<Tab>('grades')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const sorted = [...assessments].sort(byDue)
  const noted = assessments.filter((a) => a.notes.trim() !== '').length

  useEffect(() => {
    if (!focusId) return
    // defer (avoids a sync setState in the effect body) so the row is laid out,
    // then switch to the grades view, scroll to it, and glow it.
    const scroll = setTimeout(() => {
      setTab('grades')
      document
        .getElementById(`assess-${focusId}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setHighlightId(focusId)
    }, 60)
    const clear = setTimeout(() => setHighlightId(null), 2400)
    return () => {
      clearTimeout(scroll)
      clearTimeout(clear)
    }
  }, [focusId])

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-2 py-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Course view">
          <TabButton active={tab === 'grades'} onClick={() => setTab('grades')}>
            Grades
          </TabButton>
          <TabButton active={tab === 'notes'} onClick={() => setTab('notes')}>
            Notes
            {noted > 0 && (
              <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-[10px] text-subtle">
                {noted}
              </span>
            )}
          </TabButton>
        </div>
        <span className="px-2 text-[11px] text-subtle">
          {assessments.length} {assessments.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="divide-y divide-border">
        {sorted.map((a) => (
          <AssessmentRow
            key={a.id}
            assessment={a}
            tab={tab}
            highlighted={a.id === highlightId}
          />
        ))}
      </div>
    </Card>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150',
        active
          ? 'bg-surface-2 text-fg'
          : 'text-subtle hover:bg-surface-2/60 hover:text-muted',
      )}
    >
      {children}
    </button>
  )
}
