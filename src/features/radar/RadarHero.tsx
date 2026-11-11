import { CheckCircle2, CircleDashed, ListChecks, TriangleAlert } from 'lucide-react'
import { PHOTOS } from '@/data/resource-photos'
import { cn } from '@/lib/cn'
import { SEVERITY } from './radar-look'
import type { Severity } from './rules'

/**
 * The banner: the verdict first, in one line, over a campus photograph (the
 * same treatment as Resources, so the two read as one family). The counts
 * under it are the whole sweep at a glance: how many checks ran, how many
 * found something, how many are clear and how many could not look.
 */
export function RadarHero({
  severity,
  headline,
  simulated,
  counts,
}: {
  severity: Severity
  headline: string
  /** Course codes switched off in the simulator, if any. */
  simulated: string[]
  counts: { checks: number; found: number; clear: number; idle: number }
}) {
  const tone = SEVERITY[severity]
  const Icon = tone.icon
  return (
    <header className="ct-res-in relative isolate overflow-hidden rounded-3xl bg-[#0b0d16] text-white">
      <img
        src={PHOTOS.sky.src}
        alt={PHOTOS.sky.alt}
        className="ct-res-kenburns absolute inset-0 -z-20 size-full object-cover object-[50%_30%] grayscale"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(100deg, rgba(8,10,20,0.95) 0%, rgba(8,10,20,0.84) 40%, rgba(8,10,20,0.4) 75%, rgba(8,10,20,0.25) 100%), linear-gradient(0deg, rgba(8,10,20,0.7), transparent 45%)',
        }}
      />
      <div className="px-5 pt-7 pb-6 sm:px-9 sm:pt-10 sm:pb-8 lg:max-w-[70%]">
        <p className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">
          Radar
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] tracking-wide">Beta</span>
        </p>
        <div className="mt-3 flex items-start gap-3.5">
          <span className={cn('mt-1 grid size-11 shrink-0 place-items-center rounded-full text-white sm:size-12', tone.bg)}>
            <Icon size={22} aria-hidden />
          </span>
          <h2 className="font-display text-[28px] leading-[1.08] font-bold tracking-tight text-balance sm:text-[40px]">
            {headline}
          </h2>
        </div>
        <p className="mt-3.5 max-w-xl text-[14.5px] leading-relaxed text-white/80">
          An automatic check on your semester. It adds every course together and looks for what is coming but not yet
          obvious: too much of your grade in one week, a drop deadline about to close, a course the marks can no longer
          save.
        </p>
        {simulated.length > 0 && (
          <p className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-medium backdrop-blur-md">
            Showing the term without {simulated.join(', ')}
          </p>
        )}
        <ul className="mt-5 flex flex-wrap gap-2 text-[12.5px] font-medium">
          <Stat icon={ListChecks} n={counts.checks} label="checks ran" />
          <Stat icon={TriangleAlert} n={counts.found} label="found something" hot={counts.found > 0} />
          <Stat icon={CheckCircle2} n={counts.clear} label="clear" />
          {counts.idle > 0 && <Stat icon={CircleDashed} n={counts.idle} label="waiting on data" />}
        </ul>
      </div>
      <p className="border-t border-white/10 bg-black/30 px-5 py-2.5 text-[12.5px] text-white/75 backdrop-blur-sm sm:px-9">
        Runs on your account alone, each time you open this page. Nothing here changes your registration.
      </p>
    </header>
  )
}

function Stat({ icon: Icon, n, label, hot }: { icon: typeof ListChecks; n: number; label: string; hot?: boolean }) {
  return (
    <li className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-md', hot ? 'bg-white text-black' : 'bg-white/[0.12]')}>
      <Icon size={13} className={hot ? 'text-black/70' : 'text-white/70'} aria-hidden />
      <span className="font-semibold tabular-nums">{n}</span>
      <span className={hot ? 'text-black/75' : 'text-white/75'}>{label}</span>
    </li>
  )
}
