import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { LangToggle } from '@/components/LangToggle'
import { LangSwitch } from '@/components/LangSwitch'
import { LangTextToggle } from '@/components/LangTextToggle'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/cn'

type Anchor = { href: string; label: string }

const link =
  'hidden rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-fg sm:block'

/**
 * The public site's navbar: logo, in-page anchors, docs, clubs, teachers,
 * language, and the Open app button. PublicLayout renders it, and so does any
 * page that needs the real header outside that layout (the `/dev/landing/2`
 * comp), so there is one navbar rather than a copy that drifts.
 *
 * `fixed` + `height` exist for a page that pins something just under the
 * header and so needs to know exactly where the header ends. `lang` picks the
 * language control: the compact EN|FR buttons (the live site), the sliding
 * pill, or plain text that switches on press. `docs={false}` leaves Docs out of the bar,
 * for a page that links it from its footer instead.
 */
export function PublicHeader({
  anchors,
  fixed = false,
  height,
  lang = 'toggle',
  docs = true,
}: {
  /** In-page sections. Defaults to the landing page's How it works + Pricing. */
  anchors?: Anchor[]
  fixed?: boolean
  height?: number
  lang?: 'toggle' | 'pill' | 'text'
  docs?: boolean
}) {
  const t = useT()
  const sections = anchors ?? [
    { href: '#how', label: t('landing.howItWorks') },
    { href: '#pricing', label: t('landing.pricing') },
  ]
  return (
    <header
      className={cn(
        'border-b border-border/60 bg-canvas/80 backdrop-blur',
        fixed ? 'fixed inset-x-0 top-0 z-50' : 'sticky top-0 z-20',
      )}
      style={height ? { height } : undefined}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-6xl items-center justify-between px-5',
          height ? 'h-full' : 'py-4',
        )}
      >
        {/* flex, not the default inline: an inline link wrapping a block
            leaves a line box around it, which is what sat the logo and the
            button a few pixels off the row's centre. */}
        <Link to="/" aria-label="ConcordiaTracker home" className="flex items-center">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {sections.map((s) => (
            <a key={s.href} href={s.href} className={link}>
              {s.label}
            </a>
          ))}
          {docs && (
            <a href="/docs/introduction" className={link}>
              {t('landing.docs')}
            </a>
          )}
          {/* Clubs before teachers: there are far more of them, and the
              whole point is that a president finds this without being
              personally shown it. `lg:` so the mobile header stays two
              items: it overflowed at 375px once already. */}
          <Link to="/organizer" className="hidden lg:block">
            <Button variant="ghost" size="sm">
              For clubs
            </Button>
          </Link>
          <Link to="/teacher" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              {t('landing.forTeachers')}
            </Button>
          </Link>
          {/* Kept before the CTA so French is visible without scrolling or
              hunting: availability is the point, not decoration. */}
          {lang === 'text' ? (
            <LangTextToggle className="mr-1" />
          ) : lang === 'pill' ? (
            <LangSwitch className="mr-1" />
          ) : (
            <LangToggle className="mr-1" />
          )}
          <Link to="/app" className="flex">
            <Button size="sm">{t('landing.ctaPrimary')}</Button>
          </Link>
        </nav>
      </div>
    </header>
  )
}
