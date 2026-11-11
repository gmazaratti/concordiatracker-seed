import type { ReactNode } from 'react'
import { BookOpenCheck, GraduationCap, Hourglass, Layers } from 'lucide-react'
import { PHOTOS, type PhotoKey } from '@/data/resource-photos'
import { facultyKey } from '@/data/resources'
import type { Program } from '@/lib/program-progress'

const FACULTY_PHOTO: Record<string, PhotoKey> = { jmsb: 'molson', ginacody: 'ev', artsci: 'quad', finearts: 'sky' }

/**
 * The banner for My programme, in the same family as Resources and Radar: a
 * campus photograph (your own faculty's building where we have one), the
 * degree named large, and the one number the page exists to answer: how much
 * of the required coursework is done. The picker lives in the banner, since
 * choosing a programme is what everything under it depends on.
 */
export function ProgramHero({
  program,
  progress,
  inProgress,
  picker,
}: {
  program: Program | null
  progress: {
    earnedNamed: number
    requiredNamed: number
    percentNamed: number
    totalCompletedCredits: number
    unassignedCredits: number
  } | null
  /** How many of the required courses are on this term's schedule. */
  inProgress: number
  picker: ReactNode
}) {
  const photo = PHOTOS[FACULTY_PHOTO[facultyKey(program?.faculty) ?? ''] ?? 'hall']
  return (
    <header className="ct-res-in relative isolate overflow-hidden rounded-3xl bg-[#0b0d16] text-white">
      <img src={photo.src} alt={photo.alt} className="ct-res-kenburns absolute inset-0 -z-20 size-full object-cover grayscale" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(100deg, rgba(8,10,20,0.95) 0%, rgba(8,10,20,0.85) 42%, rgba(8,10,20,0.45) 78%, rgba(8,10,20,0.3) 100%), linear-gradient(0deg, rgba(8,10,20,0.7), transparent 45%)',
        }}
      />
      <div className="px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6 2xl:pt-10 2xl:pb-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0 lg:max-w-[60%]">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">My programme</p>
            <h2 className="mt-2 font-display text-[26px] leading-[1.08] font-bold tracking-tight text-balance sm:text-[32px] 2xl:text-[40px]">
              {program ? program.name : 'Where are you in your degree?'}
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/80">
              {program
                ? `${program.degree} · ${program.total_credits} credits · ${program.faculty}`
                : 'Pick your programme and this shows what the calendar asks for, ticked off against what you have done.'}
            </p>
          </div>
          {/* The picker keeps the app's own colours, on a solid plate, so it is readable over any photo. */}
          <div className="w-full rounded-2xl bg-canvas p-1.5 text-fg sm:w-80">{picker}</div>
        </div>

        {program && progress && (
          <>
            <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-display text-[52px] leading-[0.9] font-bold tabular-nums sm:text-[64px]">{progress.earnedNamed}</span>
              <span className="pb-1 text-[15px] text-white/80">
                of {progress.requiredNamed} credits in the required courses
              </span>
              <span className="ml-auto pb-1 font-display text-[22px] font-bold tabular-nums">{progress.percentNamed}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${progress.percentNamed}%` }} />
            </div>
            <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
              <Chip icon={BookOpenCheck} n={progress.totalCompletedCredits} label="credits passed in all" />
              <Chip
                icon={Layers}
                n={progress.unassignedCredits}
                label="not claimed by a required course"
                title="These probably go toward your electives. Which ones count is a rule we do not try to read, so they are not added in above."
              />
              {inProgress > 0 && <Chip icon={Hourglass} n={inProgress} label={inProgress === 1 ? 'required course in progress' : 'required courses in progress'} />}
              <Chip icon={GraduationCap} n={program.total_credits} label="credits to graduate" />
            </ul>
          </>
        )}
      </div>
    </header>
  )
}

function Chip({ icon: Icon, n, label, title }: { icon: typeof Layers; n: number; label: string; title?: string }) {
  return (
    <li title={title} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
      <Icon size={13} className="text-white/70" aria-hidden />
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-white/75">{label}</span>
    </li>
  )
}
