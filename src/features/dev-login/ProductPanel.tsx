import { CalendarCheck2, Calculator, ScanLine } from 'lucide-react'
import { AppPreview } from '@/features/landing/AppPreview'
import { useI18n } from '@/i18n/i18n'

const COPY = {
  en: {
    title: 'This is what is waiting for you.',
    body: 'Your deadlines for the week, what is overdue, and where your GPA stands. Sign in and it is yours.',
    points: ['Outlines read into dated plans', 'Grade needed, worked out', 'Concordia’s dates alongside yours'],
  },
  fr: {
    title: 'Voici ce qui vous attend.',
    body: 'Vos échéances de la semaine, ce qui est en retard et où en est votre MPC. Connectez-vous et c’est à vous.',
    points: ['Plans de cours lus et datés', 'La note nécessaire, calculée', 'Les dates de Concordia avec les vôtres'],
  },
}
const ICONS = [ScanLine, Calculator, CalendarCheck2]

/**
 * The right half of the sign-in: the real Today screen (the same `AppPreview`
 * the landing uses, built from mock data and shared components), framed and
 * bleeding off the panel's right and bottom edges so it reads as the app
 * sitting just behind the page rather than a picture of it.
 *
 * Decorative for assistive tech (`aria-hidden`): everything it says, the short
 * copy above it says in words.
 */
export function ProductPanel() {
  const { lang } = useI18n()
  const copy = COPY[lang] ?? COPY.en
  return (
    <aside className="relative hidden min-w-0 overflow-hidden border-l border-border bg-surface/50 lg:flex lg:flex-col">
      <div className="px-12 pt-14 xl:px-16">
        <h2 className="max-w-md font-display text-[30px] leading-[1.1] font-bold tracking-[-0.02em] text-fg">
          {copy.title}
        </h2>
        <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-muted">{copy.body}</p>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-muted">
          {copy.points.map((p, i) => {
            const Icon = ICONS[i]
            return (
              <li key={p} className="flex items-center gap-1.5">
                <Icon size={14} className="text-accent" aria-hidden />
                {p}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="relative mt-10 flex-1 pl-12 xl:pl-16" aria-hidden>
        <div className="absolute top-0 right-[-120px] bottom-[-60px] left-12 overflow-hidden rounded-tl-[22px] border-t border-l border-border-strong/70 bg-canvas shadow-[0_30px_100px_-30px_rgba(0,0,0,0.85)] xl:left-16">
          <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2.5">
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
              <span className="size-2.5 rounded-full bg-border-strong" />
            </span>
            <span className="ml-3 rounded-md border border-border bg-canvas/60 px-3 py-1 text-[11px] text-subtle">
              concordiatracker.com/today
            </span>
          </div>
          <div className="pointer-events-none h-full w-[920px] select-none">
            <AppPreview />
          </div>
        </div>
      </div>
    </aside>
  )
}
