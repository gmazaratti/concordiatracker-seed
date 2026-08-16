import { useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { cn } from '@/lib/cn'
import {
  addWatch,
  findSections,
  termLabel,
  type SectionOption,
} from '@/lib/seats'

/**
 * Find a section and watch it.
 *
 * Sections are shown with their live seat counts, which does two jobs: it tells
 * you whether watching is even necessary, and it proves the numbers are real
 * before you rely on an alert built from them.
 */
export function SeatWatchModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [subject, setSubject] = useState('')
  const [catalog, setCatalog] = useState('')
  const [sections, setSections] = useState<SectionOption[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  async function search() {
    if (busy) return
    setBusy(true)
    setError(null)
    setSections(null)
    try {
      setSections(await findSections(subject, catalog))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not look that up.')
    } finally {
      setBusy(false)
    }
  }

  async function watch(s: SectionOption) {
    setError(null)
    try {
      await addWatch(s, subject.trim().toUpperCase(), catalog.trim())
      setAdded(s.classNumber)
      onAdded()
    } catch (e: unknown) {
      // The plan limit is enforced server-side, so this message is authoritative.
      setError(e instanceof Error ? e.message : 'Could not add that watch.')
    }
  }

  const field =
    'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg uppercase placeholder:normal-case placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <ModalShell label="Watch for a seat" onClose={onClose} widthClass="sm:max-w-lg" scroll={false}>
      <div className="flex h-[min(78vh,620px)] flex-col">
        <div className="border-b border-border p-4">
          <h2 className="font-display text-[17px] font-semibold text-fg">Watch for a seat</h2>
          <p className="mt-0.5 text-[12.5px] text-subtle">
            We check Concordia&rsquo;s course data and push you the moment a seat opens.
          </p>

          <div className="mt-3 flex gap-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void search()}
              placeholder="COMP"
              aria-label="Subject"
              maxLength={6}
              className={cn(field, 'w-[92px]')}
            />
            <input
              value={catalog}
              onChange={(e) => setCatalog(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void search()}
              placeholder="248"
              aria-label="Course number"
              maxLength={4}
              className={cn(field, 'w-[80px]')}
            />
            <button
              type="button"
              onClick={() => void search()}
              disabled={busy || !subject.trim() || !catalog.trim()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Search size={14} aria-hidden />
              )}
              Find sections
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] font-medium text-danger">{error}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {sections === null ? (
            <p className="px-4 py-10 text-center text-[13px] text-subtle">
              Enter a course code to see its sections and how full they are.
            </p>
          ) : sections.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-subtle">
              No scheduled sections found for that course.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sections.map((s) => {
                const free =
                  s.capacity !== null && s.enrolled !== null ? s.capacity - s.enrolled : null
                const isOpen = free !== null && free > 0
                return (
                  <li key={`${s.termCode}-${s.classNumber}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 text-[13px]">
                        <span className="font-medium text-fg">
                          {s.section} · {s.component}
                        </span>
                        <span className="text-[11.5px] text-subtle">{termLabel(s.termCode)}</span>
                        {s.location && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-subtle">
                            <MapPin size={10} aria-hidden />
                            {s.location} {s.building}
                            {s.room}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-subtle">
                        {s.meetingTimes ?? 'Time TBA'}
                        {s.enrolled !== null && s.capacity !== null && (
                          <>
                            {' · '}
                            <span className={isOpen ? 'text-success' : 'text-warning'}>
                              {s.enrolled}/{s.capacity} seats
                            </span>
                          </>
                        )}
                        {/* Waitlist depth is the number nobody else shows, and
                            it's what tells you whether watching is worthwhile. */}
                        {!isOpen && s.waitlisted ? ` · ${s.waitlisted} waitlisted` : ''}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => void watch(s)}
                      disabled={added === s.classNumber}
                      className={cn(
                        'shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
                        added === s.classNumber
                          ? 'text-success'
                          : 'bg-accent-soft text-accent hover:bg-accent hover:text-accent-contrast',
                      )}
                    >
                      {added === s.classNumber ? 'Watching' : isOpen ? 'Watch anyway' : 'Watch'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="border-t border-border px-4 py-2.5 text-[11px] leading-snug text-subtle">
          Seat counts come from Concordia&rsquo;s published course data and are checked
          periodically — not continuously. Some sections hold seats for specific programs, so an
          open seat isn&rsquo;t always one you can take.
        </p>
      </div>
    </ModalShell>
  )
}
