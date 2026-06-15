import { useState } from 'react'
import { Hash, Percent } from 'lucide-react'
import type { Grade, GradeMode } from '@/data/types'
import { gradeToPercent, percentGrade } from '@/lib/grade'
import { cn } from '@/lib/cn'

/** Edits a single grade in either entry form — a direct percentage or a raw
 * earned/total score — and writes the canonical `Grade` back up. Switching mode
 * carries a resolvable value across where it can (raw → percent); the reverse
 * can't be inferred, so it clears. Empty inputs clear the grade to `null`. */
export function GradeInput({
  grade,
  onChange,
}: {
  grade: Grade | null
  onChange: (grade: Grade | null) => void
}) {
  const [mode, setMode] = useState<GradeMode>(grade?.mode ?? 'percent')

  function switchMode(next: GradeMode) {
    if (next === mode) return
    setMode(next)
    if (next === 'percent') {
      const pct = gradeToPercent(grade)
      onChange(pct === null ? null : percentGrade(Math.round(pct * 10) / 10))
    } else {
      onChange(grade?.mode === 'raw' ? grade : null)
    }
  }

  const num = (v: string): number | null => {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex overflow-hidden rounded-md border border-border-strong">
        <ModeButton
          active={mode === 'percent'}
          onClick={() => switchMode('percent')}
          label="Percent"
        >
          <Percent size={12} />
        </ModeButton>
        <ModeButton
          active={mode === 'raw'}
          onClick={() => switchMode('raw')}
          label="Raw score"
        >
          <Hash size={12} />
        </ModeButton>
      </div>

      {mode === 'percent' ? (
        <div className="flex items-center gap-1">
          <NumInput
            value={grade?.mode === 'percent' && grade.percent != null ? grade.percent : ''}
            placeholder="—"
            aria-label="Percentage grade"
            onChange={(v) => {
              const n = num(v)
              onChange(n === null ? null : percentGrade(n))
            }}
          />
          <span className="text-[12px] text-subtle">%</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <NumInput
            value={grade?.mode === 'raw' && grade.earned != null ? grade.earned : ''}
            placeholder="—"
            aria-label="Points earned"
            onChange={(v) =>
              onChange({
                mode: 'raw',
                earned: num(v),
                total: grade?.mode === 'raw' ? grade.total : null,
                percent: null,
              })
            }
          />
          <span className="text-[12px] text-subtle">/</span>
          <NumInput
            value={grade?.mode === 'raw' && grade.total != null ? grade.total : ''}
            placeholder="—"
            aria-label="Points possible"
            onChange={(v) =>
              onChange({
                mode: 'raw',
                earned: grade?.mode === 'raw' ? grade.earned : null,
                total: num(v),
                percent: null,
              })
            }
          />
        </div>
      )}
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'grid size-6 place-items-center transition-colors duration-150',
        active
          ? 'bg-accent-soft text-accent'
          : 'text-subtle hover:bg-surface-2 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

function NumInput({
  value,
  placeholder,
  onChange,
  ...rest
}: {
  value: number | ''
  placeholder: string
  onChange: (value: string) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-12 rounded-md border border-border-strong bg-surface-2 px-1.5 py-1 text-center text-[13px] font-medium text-fg tabular-nums focus-visible:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      {...rest}
    />
  )
}
