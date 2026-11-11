import { useMemo, useState } from 'react'
import { SearchX } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { stageFromCredits, type Stage } from '@/data/resource-guide'
import { facultyKey, RESOURCE_GROUPS, type Resource } from '@/data/resources'
import { summarizeRecord } from '@/lib/record-summary'
import { AdvisorStrip } from './resources/AdvisorStrip'
import { Directory, NeedGrid, TileGrid } from './resources/Directory'
import { ForYou } from './resources/ForYou'
import { ResourceSheet } from './resources/ResourceSheet'
import { ResourcesHero } from './resources/ResourcesHero'

const STAGE_KEY = 'ct_resources_stage'
const ALL = RESOURCE_GROUPS.flatMap((g) => g.items.map((r) => ({ r, hay: `${r.name} ${r.what} ${g.title} ${r.where ?? ''}`.toLowerCase() })))

function savedStage(): Stage | null {
  try {
    const v = localStorage.getItem(STAGE_KEY)
    return v === 'first' || v === 'middle' || v === 'final' ? v : null
  } catch {
    return null
  }
}

/**
 * Who to contact at Concordia, for what (data/resources.ts, advisors.ts,
 * resource-guide.ts). Top to bottom: the banner and search, a short list for
 * your year, the advisors themselves, eight plain "I need" doors, then the
 * whole directory one category at a time. Details open in a sheet, so the
 * page is names and one-liners, not a wall of phone numbers.
 */
export function ResourcesPanel() {
  const { user, pastCourses, assessments } = useAppData()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Resource | null>(null)
  const [group, setGroup] = useState(RESOURCE_GROUPS[0].id)
  const [picked, setPicked] = useState<Stage | null>(savedStage)
  const [month] = useState(() => new Date().getMonth())

  const program = `${user.school ?? ''} ${user.program ?? ''}`
  const mine = facultyKey(program) ?? null
  const earned = useMemo(() => summarizeRecord(pastCourses, assessments).credits, [pastCourses, assessments])
  const stage = picked ?? stageFromCredits(earned)
  const setStage = (s: Stage) => {
    setPicked(s)
    try {
      localStorage.setItem(STAGE_KEY, s)
    } catch {
      /* a preference, not a record */
    }
  }

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const hits = words.length ? ALL.filter(({ hay }) => words.every((w) => hay.includes(w))).map(({ r }) => r) : null
  const openOffice = (f: NonNullable<Resource['faculty']>) => {
    const r = ALL.find(({ r }) => r.faculty === f)?.r
    if (r) setOpen(r)
  }

  return (
    <div className="space-y-9 pb-4">
      <ResourcesHero q={q} setQ={setQ} count={ALL.length} firstName={(user.name ?? '').trim().split(/\s+/)[0] ?? ''} />

      {hits ? (
        <section aria-live="polite">
          <h3 className="font-display text-[20px] font-semibold tracking-tight text-fg">
            {hits.length} {hits.length === 1 ? 'match' : 'matches'}
          </h3>
          {hits.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
              <SearchX size={22} className="text-subtle" aria-hidden />
              <p className="mt-2 text-[14px] font-semibold text-fg">Nothing matches “{q.trim()}”</p>
              <p className="mt-1 max-w-xs text-[13px] text-muted">
                Try one plain word, like fees or exams. If you are not sure who handles something, Birks will tell you.
              </p>
              <button
                type="button"
                onClick={() => setQ('Birks')}
                className="mt-3 text-[13px] font-semibold text-accent hover:underline"
              >
                Show Birks
              </button>
            </div>
          ) : (
            <TileGrid key={q} items={hits} mine={mine} onOpen={setOpen} />
          )}
        </section>
      ) : (
        <>
          <ForYou stage={stage} setStage={setStage} guessed={!picked} faculty={mine} month={month} onOpen={setOpen} />
          <AdvisorStrip mine={mine} program={user.program ?? ''} onOffice={openOffice} />
          <NeedGrid faculty={mine} onOpen={setOpen} />
          <Directory group={group} setGroup={setGroup} mine={mine} onOpen={setOpen} />
        </>
      )}

      {open && <ResourceSheet r={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
