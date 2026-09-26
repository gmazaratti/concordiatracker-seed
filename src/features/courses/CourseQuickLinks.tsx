import { useState } from 'react'
import { ExternalLink, Link2, Plus, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import type { Course, QuickLink } from '@/data/types'
import { useT } from '@/i18n/i18n'

const MAX = 12

/** A URL we will put in an href: http(s) only, so `javascript:` never lands. */
function cleanUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/** The label to show when none was given: the site's name, not the whole URL. */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Your own links for this class: the homework portal, a lab site, the
 * publisher's assignments page. One tap from the course instead of a bookmark
 * hunt. Stored on YOUR course row, so they are private to you and never go
 * out with an outline or a blueprint (db/course_quick_links.sql).
 */
export function CourseQuickLinks({ course }: { course: Course }) {
  const t = useT()
  const { updateCourse } = useAppData()
  const links = course.quickLinks ?? []
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  function save(next: QuickLink[]) {
    updateCourse(course.id, { quickLinks: next })
  }

  function add() {
    const clean = cleanUrl(url)
    if (!clean) return setError(t('quickLinks.badUrl'))
    save([...links, { label: label.trim().slice(0, 40) || hostLabel(clean), url: clean }])
    setLabel('')
    setUrl('')
    setError(null)
    setAdding(false)
  }

  const field =
    'w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <div className="border-t border-border px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        <Link2 size={12} aria-hidden />
        {t('quickLinks.title')}
      </p>

      {links.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {links.map((l, i) => (
            <li key={`${l.url}-${i}`} className="group flex items-center gap-2">
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                title={l.url}
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] text-accent transition-colors hover:bg-surface-2 hover:text-accent-hover"
              >
                <span className="truncate">{l.label}</span>
                <ExternalLink size={12} className="shrink-0" aria-hidden />
              </a>
              <button
                type="button"
                onClick={() => save(links.filter((_, j) => j !== i))}
                aria-label={t('quickLinks.remove', { label: l.label })}
                className="grid size-7 shrink-0 place-items-center rounded-md text-subtle opacity-100 transition-colors hover:bg-surface-2 hover:text-danger [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
              >
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="mt-2 flex flex-col gap-1.5">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://learn.wileyplus.com/…" aria-label={t('quickLinks.url')} className={field} autoFocus />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={t('quickLinks.labelPlaceholder')}
            aria-label={t('quickLinks.label')}
            maxLength={40}
            className={field}
          />
          {error && <p className="text-[11.5px] text-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={add} className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-contrast hover:bg-accent-hover">
              {t('quickLinks.save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setError(null)
              }}
              className="rounded-md px-2.5 py-1 text-[12px] font-medium text-muted hover:text-fg"
            >
              {t('quickLinks.cancel')}
            </button>
          </div>
        </div>
      ) : (
        links.length < MAX && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <Plus size={13} aria-hidden />
            {links.length === 0 ? t('quickLinks.addFirst') : t('quickLinks.add')}
          </button>
        )
      )}
    </div>
  )
}
