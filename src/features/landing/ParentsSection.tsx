import { Link } from 'react-router-dom'
import { CalendarCheck, EyeOff, Lock, Users } from 'lucide-react'
import { useT } from '@/i18n/i18n'

/**
 * "For parents" on the landing page. Family access is the student's choice
 * (they send the invite), so this speaks to both: a parent learning what they
 * would see, and a student who wants to set it up.
 */
export function ParentsSection() {
  const t = useT()
  const points = [
    { icon: CalendarCheck, title: t('landing.parents1Title'), body: t('landing.parents1Body') },
    { icon: Lock, title: t('landing.parents2Title'), body: t('landing.parents2Body') },
    { icon: EyeOff, title: t('landing.parents3Title'), body: t('landing.parents3Body') },
  ]
  return (
    <section id="parents" className="scroll-mt-20 border-t border-border/60 px-5 py-24 sm:py-28">
      <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.14em] text-accent uppercase">
            <Users size={14} aria-hidden /> {t('landing.parentsEyebrow')}
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.8rem,3.4vw,2.6rem)] leading-tight font-semibold text-balance text-fg">
            {t('landing.parentsHeading')}
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">{t('landing.parentsBody')}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/app?settings=family"
              className="inline-flex items-center rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              {t('landing.parentsCta')}
            </Link>
            <span className="text-[13px] text-subtle">{t('landing.parentsNote')}</span>
          </div>
        </div>
        <ul className="grid gap-3">
          {points.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <p.icon size={17} aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-fg">{p.title}</span>
                <span className="mt-0.5 block text-[13.5px] leading-relaxed text-muted">{p.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
