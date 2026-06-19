import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Library, Loader2, Plus, Search, ShieldCheck, X } from 'lucide-react'
import type { Course } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { normalizeCode } from '@/lib/supabase-adapters'
import { courseColor } from '@/lib/course-color'
import { termRank } from '@/lib/term'
import { Select } from '@/components/ui/Select'
import { BlueprintList } from './BlueprintList'
import { useAllBlueprintCourses, type BlueprintCodeMatch } from './useBlueprints'

type SortMode = 'code' | 'term-desc' | 'term-asc'
const SORT_OPTIONS = [
  { value: 'code', label: 'Course code' },
  { value: 'term-desc', label: 'Term — newest' },
  { value: 'term-asc', label: 'Term — oldest' },
]

/** The blueprint browser — a full page inside Courses (NOT a sidebar tab). Leads
 * with the browsable marketplace: every course that has a shared outline. Courses
 * you're enrolled in are marked "Enrolled" and open directly; others are added to
 * your courses on pick, then opened. Your private courses are NOT listed here —
 * nothing is shared unless you opt in via "Share as blueprint". */
export function BlueprintBrowserPage() {
  const { courses, courseById, createCourse } = useAppData()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('course')
  const selected = selectedId ? courseById(selectedId) : undefined
  const [typed, setTyped] = useState('')
  const [sort, setSort] = useState<SortMode>('code')
  const { list: outlines, loading } = useAllBlueprintCourses()

  // Normalized code → your enrolled course (to mark "Enrolled" + open directly).
  const enrolled = useMemo(() => {
    const m = new Map<string, Course>()
    for (const c of courses) if (c.code) m.set(normalizeCode(c.code), c)
    return m
  }, [courses])

  const q = typed.trim().toLowerCase()
  const filtered = useMemo(() => {
    const matched = outlines.filter(
      (o) => !q || o.code.toLowerCase().includes(q) || o.courseName.toLowerCase().includes(q),
    )
    return matched.sort((a, b) => {
      if (sort === 'code') return a.code.localeCompare(b.code)
      const byTerm = termRank(b.term) - termRank(a.term) // newest first
      const dir = sort === 'term-desc' ? byTerm : -byTerm
      return dir !== 0 ? dir : a.code.localeCompare(b.code)
    })
  }, [outlines, q, sort])

  function onSearch(value: string) {
    setTyped(value)
    if (selected) setParams({}) // editing the search returns to the marketplace
  }
  function clear() {
    setTyped('')
    setParams({})
  }
  // Open an outline: enrolled → its own list; otherwise add the course, then open.
  async function openOutline(o: BlueprintCodeMatch) {
    const mine = enrolled.get(o.code)
    if (mine) {
      setTyped('')
      setParams({ course: mine.id })
      return
    }
    const id = await createCourse({ code: o.code, title: o.courseName })
    if (id) {
      setTyped('')
      setParams({ course: id })
    }
  }

  const inputValue = selected ? selected.code : typed

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <header className="mb-4">
        <Link
          to="/app/courses"
          className="inline-flex items-center gap-1.5 text-[12px] text-subtle transition-colors duration-150 hover:text-fg"
        >
          <ArrowLeft size={14} aria-hidden />
          Courses
        </Link>
        <h1 className="mt-1.5 font-display text-[26px] leading-tight font-medium text-fg">
          Blueprints
        </h1>
        <p className="mt-0.5 text-[13px] text-subtle">
          Import a classmate's or teacher's syllabus — every assessment, weight, and date.
        </p>
      </header>

      <div className="relative mb-5">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={(e) => {
            if (selected) e.currentTarget.select()
          }}
          placeholder="Search a course by code or name…"
          aria-label="Search a course"
          className="w-full rounded-xl border border-border-strong bg-surface py-3 pr-10 pl-10 text-[14px] text-fg placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none"
        />
        {(typed || selected) && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <X size={15} aria-hidden />
          </button>
        )}
      </div>

      {selected ? (
        <>
          <div className="mb-3 flex items-center gap-2.5">
            <span
              className="h-5 w-1.5 rounded-full"
              style={{ backgroundColor: courseColor(selected.color).hex }}
              aria-hidden
            />
            <h2 className="text-[15px] font-medium text-fg">
              {selected.code}
              <span className="ml-2 text-[13px] font-normal text-subtle">{selected.title}</span>
            </h2>
          </div>
          <BlueprintList key={selected.id} course={selected} />
        </>
      ) : loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading outlines" />
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
              {q ? 'Matching outlines' : 'Available outlines'}
            </p>
            {filtered.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-subtle">Sort</span>
                <Select
                  value={sort}
                  onChange={(v) => setSort(v as SortMode)}
                  options={SORT_OPTIONS}
                  ariaLabel="Sort outlines"
                  size="sm"
                  tone="control"
                  className="w-[150px]"
                />
              </div>
            )}
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[13px] text-subtle">
              {q ? (
                <>No shared outline matches “{typed}” yet.</>
              ) : (
                <>No shared outlines yet — be the first to contribute one.</>
              )}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((o) => (
                <OutlineRow key={o.code} outline={o} mine={enrolled.get(o.code)} onOpen={() => openOutline(o)} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/** One course in the marketplace list. Enrolled courses keep their identity color
 * and a quiet "Enrolled" tag; others show an "Add" affordance. */
function OutlineRow({
  outline,
  mine,
  onOpen,
}: {
  outline: BlueprintCodeMatch
  mine?: Course
  onOpen: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
      >
        {mine ? (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: courseColor(mine.color).hex }}
            aria-hidden
          />
        ) : (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-subtle group-hover:text-muted">
            <Library size={14} aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[14px] font-medium text-fg">{outline.code}</span>
            <span className="truncate text-[12px] text-subtle">{outline.courseName}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          {outline.term && (
            <span className="hidden rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-subtle sm:inline">
              {outline.term}
            </span>
          )}
          {outline.hasVerified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
              <ShieldCheck size={12} aria-hidden />
              Verified
            </span>
          )}
          <span className="text-[12px] text-muted">
            {outline.count} blueprint{outline.count === 1 ? '' : 's'}
          </span>
          {mine ? (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-subtle uppercase">
              Enrolled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-accent">
              <Plus size={13} aria-hidden />
              Add
            </span>
          )}
          <ChevronRight
            size={16}
            className="text-subtle transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </button>
    </li>
  )
}
