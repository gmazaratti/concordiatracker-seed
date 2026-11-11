import type { ReactNode } from 'react'
import { BookOpenCheck, GraduationCap, Layers, ShieldCheck } from 'lucide-react'
import { PHOTOS } from '@/data/resource-photos'

/**
 * The banner for My record, in the same family as My programme, Radar and
 * Resources. It leads with the number people open this page for (the GPA, or
 * the credits when nothing is graded yet), with the counts as chips and the
 * page's actions on the right.
 */
export function RecordHero({
  gpa,
  credits,
  gradedCredits,
  courses,
  subjects,
  complete,
  actions,
}: {
  gpa: number | null
  credits: number
  gradedCredits: number
  courses: number
  subjects: string[]
  /** The student has said this is every course they have finished. */
  complete: boolean
  actions: ReactNode
}) {
  const empty = courses === 0
  return (
    <header className="ct-res-in relative isolate overflow-hidden rounded-3xl bg-[#0b0d16] text-white">
      <img src={PHOTOS.stacks.src} alt={PHOTOS.stacks.alt} className="ct-res-kenburns absolute inset-0 -z-20 size-full object-cover grayscale" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(100deg, rgba(8,10,20,0.95) 0%, rgba(8,10,20,0.85) 42%, rgba(8,10,20,0.45) 78%, rgba(8,10,20,0.3) 100%), linear-gradient(0deg, rgba(8,10,20,0.7), transparent 45%)',
        }}
      />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6 2xl:pt-10 2xl:pb-8">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">My record</p>
          {empty ? (
            <>
              <h2 className="mt-2 font-display text-[26px] leading-[1.08] font-bold tracking-tight text-balance sm:text-[32px] 2xl:text-[40px]">
                What have you finished so far?
              </h2>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/80">
                Add the courses you have completed and this page works out your credits, your GPA and what you can take
                next. Grades are optional.
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="font-display text-[60px] leading-[0.9] font-bold tabular-nums sm:text-[76px]">
                  {gpa === null ? credits : gpa.toFixed(2)}
                </span>
                <span className="pb-1.5 text-[15px] text-white/80">
                  {gpa === null ? (
                    <>credits finished. Add a grade to see your GPA.</>
                  ) : (
                    <>
                      GPA, over {gradedCredits} graded {gradedCredits === 1 ? 'credit' : 'credits'}
                    </>
                  )}
                </span>
              </div>
              <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
                <Chip icon={BookOpenCheck} n={credits} label={credits === 1 ? 'credit done' : 'credits done'} />
                <Chip icon={GraduationCap} n={courses} label={courses === 1 ? 'course' : 'courses'} />
                <Chip icon={Layers} n={subjects.length} label={subjects.slice(0, 3).join(' · ') || 'subjects'} />
                {complete && (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-black">
                    <ShieldCheck size={13} aria-hidden /> Marked complete
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      <p className="border-t border-white/10 bg-black/30 px-5 py-2.5 text-[12.5px] text-white/75 backdrop-blur-sm sm:px-8">
        Self-reported, from what you enter here. It is not an official transcript.
      </p>
    </header>
  )
}

function Chip({ icon: Icon, n, label }: { icon: typeof Layers; n: number; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
      <Icon size={13} className="text-white/70" aria-hidden />
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-white/75">{label}</span>
    </li>
  )
}
