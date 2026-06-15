import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { COURSE_COLORS } from '@/lib/course-color'
import { cn } from '@/lib/cn'

/** The Google-Classroom touch: recolor a class from its banner. Writes the new
 * color id through the store (in-memory) — every surface that reads the course
 * (grid card, list stripe, this banner) recolors at once. Rendered on the colored
 * banner, so the trigger is styled to read as translucent-white on the accent. */
export function CourseColorPicker({
  courseId,
  color,
}: {
  courseId: string
  color: string
}) {
  const { setCourseColor } = useAppData()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change class color"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/25"
      >
        <Palette size={14} aria-hidden />
        Color
      </button>

      {open && (
        <div
          role="menu"
          className="ct-animate-pop absolute top-full right-0 z-40 mt-2 w-[184px] rounded-xl border border-border bg-surface p-2.5 shadow-2xl"
        >
          <p className="px-0.5 pb-2 text-[11px] text-subtle">Class color</p>
          <div className="grid grid-cols-4 gap-2">
            {COURSE_COLORS.map((c) => {
              const active = c.id === color
              return (
                <button
                  key={c.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  aria-label={c.label}
                  title={c.label}
                  onClick={() => {
                    setCourseColor(courseId, c.id)
                    setOpen(false)
                  }}
                  style={{ backgroundColor: c.hex }}
                  className={cn(
                    'grid size-8 place-items-center rounded-full text-white transition-transform duration-150 hover:scale-110',
                    active && 'ring-2 ring-fg ring-offset-2 ring-offset-surface',
                  )}
                >
                  {active && <Check size={15} aria-hidden />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
