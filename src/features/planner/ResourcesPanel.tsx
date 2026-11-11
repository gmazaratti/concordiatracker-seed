import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { ADVISORS } from '@/data/advisors'
import { GUIDES, guideBySlug, guidesFor } from '@/data/guides'
import { STAGES, stageFromCredits, type Stage } from '@/data/resource-guide'
import { PHOTOS } from '@/data/resource-photos'
import { facultyKey, RESOURCE_GROUPS, type Resource } from '@/data/resources'
import { summarizeRecord } from '@/lib/record-summary'
import { AdvisorStrip } from './resources/AdvisorStrip'
import { Directory, NeedGrid, TileGrid } from './resources/Directory'
import { ForYou } from './resources/ForYou'
import { GuideReader } from './resources/GuideReader'
import { GuideCard, GuideShelf } from './resources/GuideShelf'
import { ResourceSheet } from './resources/ResourceSheet'
import { ResourcesHero } from './resources/ResourcesHero'

const STAGE_KEY = 'ct_resources_stage'
const ALL = RESOURCE_GROUPS.flatMap((g) =>
  g.items.map((r) => ({ r, hay: `${r.name} ${r.what} ${g.title} ${r.where ?? ''}`.toLowerCase() })),
)
const GUIDE_HAY = GUIDES.map((g) => ({ g, hay: `${g.title} ${g.dek} ${g.tag} ${JSON.stringify(g.body)}`.toLowerCase() }))
const ADVISOR_COUNT = Object.values(ADVISORS).reduce((n, l) => n + l.people.length, 0)

function savedStage(): Stage | null {
  try {
    const v = localStorage.getItem(STAGE_KEY)
    return v === 'first' || v === 'middle' || v === 'final' ? v : null
  } catch {
    return null
  }
}

/**
 * Who to contact at Concordia, and what to know (data/resources.ts,
 * advisors.ts, resource-guide.ts, guides.ts). Top to bottom: the photo banner
 * and search, the guide and short list for your year, the shelf of guides, the
 * advisors themselves, ten plain "I need" doors, then the whole directory one
 * category at a time. Details open in a sheet and guides in a reader (the
 * guide is in the URL as ?guide=, so it can be linked and Back closes it).
 */
export function ResourcesPanel() {
  const { user, pastCourses, assessments } = useAppData()
  const [params, setParams] = useSearchParams()
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

  const shelf = guidesFor(stage)
  const reading = guideBySlug(params.get('guide'))
  const read = (slug: string | null) => {
    const next = new URLSearchParams(params)
    if (slug) next.set('guide', slug)
    else next.delete('guide')
    setParams(next, { replace: !slug || !!reading })
  }
  const after = reading ? shelf[(shelf.findIndex((g) => g.slug === reading.slug) + 1) % shelf.length] : undefined

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const hits = words.length ? ALL.filter(({ hay }) => words.every((w) => hay.includes(w))).map(({ r }) => r) : null
  const guideHits = words.length ? GUIDE_HAY.filter(({ hay }) => words.every((w) => hay.includes(w))).map(({ g }) => g) : []
  const openOffice = (f: NonNullable<Resource['faculty']>) => {
    const r = ALL.find(({ r }) => r.faculty === f)?.r
    if (r) setOpen(r)
  }

  return (
    <div className="space-y-10 pb-4">
      <ResourcesHero
        q={q}
        setQ={setQ}
        firstName={(user.name ?? '').trim().split(/\s+/)[0] ?? ''}
        counts={{ offices: ALL.length, advisors: ADVISOR_COUNT, guides: GUIDES.length }}
      />

      {hits ? (
        <section aria-live="polite" className="space-y-6">
          {hits.length + guideHits.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center">
              <SearchX size={22} className="text-subtle" aria-hidden />
              <p className="mt-2 text-[14px] font-semibold text-fg">Nothing matches “{q.trim()}”</p>
              <p className="mt-1 max-w-xs text-[13px] text-muted">
                Try one plain word, like fees or exams. If you are not sure who handles something, Birks will tell you.
              </p>
              <button type="button" onClick={() => setQ('Birks')} className="mt-3 text-[13px] font-semibold text-accent hover:underline">
                Show Birks
              </button>
            </div>
          ) : (
            <>
              {guideHits.length > 0 && (
                <div>
                  <h3 className="font-display text-[22px] font-semibold tracking-tight text-fg">
                    {guideHits.length} {guideHits.length === 1 ? 'guide' : 'guides'}
                  </h3>
                  <div key={q} className="mt-3 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    {guideHits.map((g) => (
                      <div key={g.slug} className="h-[300px]">
                        <GuideCard g={g} onRead={read} fill />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hits.length > 0 && (
                <div>
                  <h3 className="font-display text-[22px] font-semibold tracking-tight text-fg">
                    {hits.length} {hits.length === 1 ? 'office' : 'offices'}
                  </h3>
                  <TileGrid key={q} items={hits} mine={mine} onOpen={setOpen} />
                </div>
              )}
            </>
          )}
        </section>
      ) : (
        <>
          <ForYou
            stage={stage}
            setStage={setStage}
            guessed={!picked}
            faculty={mine}
            month={month}
            onOpen={setOpen}
            guide={shelf[0]}
            onRead={read}
          />
          <GuideShelf
            key={stage}
            guides={shelf.slice(1)}
            onRead={read}
            lead={`Written for students, checked against Concordia’s own pages. ${STAGES.find((s) => s.id === stage)!.label} first.`}
          />
          <AdvisorStrip mine={mine} program={user.program ?? ''} onOffice={openOffice} />
          <NeedGrid faculty={mine} onOpen={setOpen} />
          <Directory group={group} setGroup={setGroup} mine={mine} onOpen={setOpen} />
        </>
      )}

      <PhotoCredits />

      {reading && (
        <GuideReader g={reading} faculty={mine} onClose={() => read(null)} onOpen={setOpen} next={after} onRead={read} />
      )}
      {open && <ResourceSheet r={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/** The licences require credit, so this stays on the page. */
function PhotoCredits() {
  const list = Object.values(PHOTOS)
  return (
    <p className="border-t border-border pt-4 text-[11.5px] leading-relaxed text-subtle">
      Photos from Wikimedia Commons, cropped and tinted:{' '}
      {list.map((p, i) => (
        <span key={p.src}>
          <a href={p.page} target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-fg">
            {p.by}
          </a>{' '}
          ({p.licence}){i < list.length - 1 ? ', ' : '. '}
        </span>
      ))}
      ConcordiaTracker is not affiliated with Concordia University.
    </p>
  )
}
