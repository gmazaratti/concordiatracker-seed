import { useEffect, useRef, useState } from 'react'
import { Check, Lock, Palette, Sparkles } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useSettings } from '@/app/providers/settings'
import { COURSE_COLORS } from '@/lib/course-color'
import { COURSE_GRADIENTS, COURSE_ICON_GROUPS, courseIcon } from '@/lib/course-style'
import type { Course } from '@/data/types'
import { cn } from '@/lib/cn'

/**
 * Make a class look like itself: colour, gradient, icon.
 *
 * Colour is free and always will be — a class list you can tell apart is the
 * product, not the upgrade. Gradients and icons are the Semester pass, on the
 * same line the themes draw. Locked options are shown IN FULL rather than
 * hidden: you can see exactly what you would get, which is a fairer way to sell
 * something than a padlock over a blank.
 *
 * Nothing here is load-bearing. Every card still shows the course code, so a
 * lapsed pass costs decoration and never information — and the stored values
 * are kept rather than wiped, so they come back when the pass does.
 */
type Tab = 'color' | 'gradient' | 'icon'

export function CourseStylePicker({ course }: { course: Course }) {
  const { setCourseColor, updateCourse, plan } = useAppData()
  const { openSettings } = useSettings()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('color')
  const ref = useRef<HTMLDivElement>(null)
  const pro = plan !== 'free'
  const current = courseIcon(course.icon)

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

  /** A locked click sells rather than fails — and says what it is selling. */
  const gate = () => {
    setOpen(false)
    openSettings('billing')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Change how this class looks"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm transition-colors duration-150 hover:bg-white/25"
      >
        {current ? <current.icon size={14} aria-hidden /> : <Palette size={14} aria-hidden />}
        Style
      </button>

      {open && (
        <div
          role="menu"
          className="ct-animate-pop absolute top-full right-0 z-40 mt-2 w-[276px] rounded-xl border border-border bg-surface shadow-2xl"
        >
          <div className="flex gap-1 border-b border-border p-1.5">
            {(
              [
                ['color', 'Colour', true],
                ['gradient', 'Gradient', pro],
                ['icon', 'Icon', pro],
              ] as const
            ).map(([id, label, allowed]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-selected={tab === id}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors duration-150',
                  tab === id ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg',
                )}
              >
                {label}
                {!allowed && <Lock size={10} aria-hidden />}
              </button>
            ))}
          </div>

          <div className="max-h-[300px] overflow-y-auto p-2.5">
            {tab === 'color' && (
              <div className="grid grid-cols-4 gap-2">
                {COURSE_COLORS.map((c) => {
                  const active = c.id === course.color && !course.gradient
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      aria-label={c.label}
                      title={c.label}
                      onClick={() => {
                        // Choosing a flat colour clears the gradient — otherwise
                        // the banner keeps the gradient and the colour looks
                        // like it did nothing.
                        if (course.gradient) updateCourse(course.id, { gradient: undefined })
                        setCourseColor(course.id, c.id)
                        setOpen(false)
                      }}
                      style={{ backgroundColor: c.hex }}
                      className={cn(
                        'grid size-9 place-items-center rounded-full text-white transition-transform duration-150 hover:scale-110',
                        active && 'ring-2 ring-fg ring-offset-2 ring-offset-surface',
                      )}
                    >
                      {active && <Check size={15} aria-hidden />}
                    </button>
                  )
                })}
              </div>
            )}

            {tab === 'gradient' && (
              <>
                {!pro && <ProNote what="Gradients" onUpgrade={gate} />}
                <div className="grid grid-cols-3 gap-2">
                  {COURSE_GRADIENTS.map((g) => {
                    const active = g.id === course.gradient
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        aria-label={g.label}
                        title={pro ? g.label : `${g.label} — Semester pass`}
                        onClick={() => {
                          if (!pro) return gate()
                          updateCourse(course.id, { gradient: g.id })
                          setOpen(false)
                        }}
                        style={{ backgroundImage: `linear-gradient(125deg, ${g.from}, ${g.to})` }}
                        className={cn(
                          'grid h-11 place-items-center rounded-lg text-white transition-transform duration-150 hover:scale-105',
                          active && 'ring-2 ring-fg ring-offset-2 ring-offset-surface',
                          !pro && 'opacity-80',
                        )}
                      >
                        {active ? (
                          <Check size={15} aria-hidden />
                        ) : !pro ? (
                          <Lock size={12} className="opacity-80" aria-hidden />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {tab === 'icon' && (
              <>
                {!pro && <ProNote what="Icons" onUpgrade={gate} />}
                {course.icon && pro && (
                  <button
                    type="button"
                    onClick={() => {
                      updateCourse(course.id, { icon: undefined })
                      setOpen(false)
                    }}
                    className="mb-2 w-full rounded-lg border border-border px-2 py-1.5 text-[11.5px] text-muted transition-colors duration-150 hover:text-fg"
                  >
                    Remove icon
                  </button>
                )}
                {COURSE_ICON_GROUPS.map((group) => (
                  <div key={group.label} className="mb-3 last:mb-0">
                    <p className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {group.icons.map((i) => {
                        const Icon = i.icon
                        const active = i.id === course.icon
                        return (
                          <button
                            key={i.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            aria-label={i.label}
                            title={pro ? i.label : `${i.label} — Semester pass`}
                            onClick={() => {
                              if (!pro) return gate()
                              updateCourse(course.id, { icon: i.id })
                              setOpen(false)
                            }}
                            className={cn(
                              'grid aspect-square place-items-center rounded-lg border transition-colors duration-150',
                              active
                                ? 'border-accent bg-accent-soft text-accent'
                                : 'border-transparent text-muted hover:border-border hover:text-fg',
                            )}
                          >
                            <Icon size={15} aria-hidden />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProNote({ what, onUpgrade }: { what: string; onUpgrade: () => void }) {
  return (
    <button
      type="button"
      onClick={onUpgrade}
      className="mb-2.5 flex w-full items-start gap-2 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-2 text-left transition-colors duration-150 hover:bg-accent/15"
    >
      <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-fg">
          {what} come with the Semester pass
        </span>
        <span className="block text-[11px] leading-snug text-subtle">
          Pick one to see the whole thing. Your colours stay free either way.
        </span>
      </span>
    </button>
  )
}
