import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useCommandPalette } from '@/app/providers/command-palette'
import { useTheme } from '@/app/providers/theme'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { useSettings } from '@/app/providers/settings'
import { CourseChip } from '@/components/CourseChip'
import {
  dynamicCommands,
  matchCommands,
  STATIC_COMMANDS,
  type Command,
} from './commands'

const GROUP_ORDER = ['Navigate', 'Actions'] as const

/** Mounts the dialog only while open so its state is fresh on each open. */
export function CommandPalette() {
  const { open } = useCommandPalette()
  if (!open) return null
  return <CommandPaletteDialog />
}

function CommandPaletteDialog() {
  const { closePalette } = useCommandPalette()
  const navigate = useNavigate()
  const { toggleTheme } = useTheme()
  const { courses, assessments } = useAppData()
  const { openAssessment, openCourse } = useQuickActions()
  const { openSettings } = useSettings()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<Element | null>(null)

  const commands = useMemo(
    () => [...STATIC_COMMANDS, ...dynamicCommands(courses, assessments)],
    [courses, assessments],
  )
  const results = useMemo(
    () => matchCommands(query, commands),
    [query, commands],
  )
  const activeIndex = results.length ? Math.min(active, results.length - 1) : 0

  /** Autofill: rewrite the query and re-home the selection at the top. */
  function fillQuery(text: string) {
    setQuery(text)
    setActive(0)
    inputRef.current?.focus()
  }

  // Focus the input on open; restore focus + unlock scroll on close.
  useEffect(() => {
    restoreRef.current = document.activeElement
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      cancelAnimationFrame(id)
      document.body.style.overflow = ''
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [])

  function run(cmd: Command | undefined) {
    cmd?.perform({
      navigate,
      close: closePalette,
      toggleTheme,
      setQuery: fillQuery,
      openAssessment,
      openCourse,
      openSettings,
    })
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(results.length ? (activeIndex + 1) % results.length : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(
        results.length ? (activeIndex - 1 + results.length) % results.length : 0,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(results[activeIndex])
    } else if (e.key === 'Tab') {
      e.preventDefault() // trap focus inside the palette
    }
  }

  const sections = query
    ? [{ label: 'Results', items: indexed(results) }]
    : GROUP_ORDER.map((label) => ({
        label,
        items: indexed(results).filter((r) => r.cmd.group === label),
      })).filter((s) => s.items.length)

  return (
    <div
      className="ct-animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-start sm:p-4 sm:pt-[12vh]"
      onMouseDown={closePalette}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="ct-animate-pop flex max-h-[70vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:max-w-xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={18} className="shrink-0 text-subtle" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={
              results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined
            }
            placeholder="Search or jump to…  (try “Change grade for…”)"
            className="w-full bg-transparent py-4 text-[15px] text-fg outline-none placeholder:text-subtle"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-canvas px-1.5 py-0.5 text-[11px] text-muted sm:block">
            Esc
          </kbd>
        </div>

        <div
          id="command-list"
          role="listbox"
          aria-label="Commands"
          className="overflow-y-auto py-2"
        >
          {results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-subtle">
              No matching commands.
            </p>
          )}
          {sections.map((section) => (
            <div key={section.label} className="px-2">
              <p className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-subtle uppercase">
                {section.label}
              </p>
              {section.items.map(({ cmd, index }) => (
                <Row
                  key={cmd.id}
                  cmd={cmd}
                  active={index === activeIndex}
                  onHover={() => setActive(index)}
                  onSelect={() => run(cmd)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function indexed(list: Command[]) {
  return list.map((cmd, index) => ({ cmd, index }))
}

function Row({
  cmd,
  active,
  onHover,
  onSelect,
}: {
  cmd: Command
  active: boolean
  onHover: () => void
  onSelect: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const Icon = cmd.icon
  return (
    <button
      ref={ref}
      id={`cmd-${cmd.id}`}
      role="option"
      aria-selected={active}
      type="button"
      onMouseMove={onHover}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 ${
        active ? 'bg-accent-soft text-fg' : 'text-muted'
      }`}
    >
      <Icon
        size={17}
        className={active ? 'text-accent' : 'text-subtle'}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[14px] text-fg">
        {cmd.title}
      </span>
      {cmd.badge && cmd.accentColor && (
        <CourseChip code={cmd.badge} color={cmd.accentColor} />
      )}
      {cmd.hint && <span className="text-[11px] text-subtle">{cmd.hint}</span>}
    </button>
  )
}
