import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { courseColor } from '@/lib/course-color'
import { BlueprintCoursePicker } from './BlueprintCoursePicker'
import { BlueprintList } from './BlueprintList'

/** The blueprint browser — a full page inside Courses (NOT a sidebar tab),
 * reached from the Courses "Import syllabus" button (unfiltered) or an empty
 * course card (pre-filtered). The selected course lives in the URL (`?course=`)
 * so the browser Back button returns to the picker, not all the way to Courses. */
export function BlueprintBrowserPage() {
  const { courses, courseById } = useAppData()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('course')
  const selected = selectedId ? courseById(selectedId) : undefined
  const [typed, setTyped] = useState('')

  function onSearch(value: string) {
    setTyped(value)
    if (selected) setParams({}) // editing the search returns to the picker
  }
  function pick(id: string) {
    setTyped('')
    setParams({ course: id }) // a real history entry → Back returns here
  }
  function clear() {
    setTyped('')
    setParams({})
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
      ) : (
        <BlueprintCoursePicker courses={courses} query={typed} onPick={pick} />
      )}
    </div>
  )
}
