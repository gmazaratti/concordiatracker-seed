import { Link } from 'react-router-dom'
import {
  ChevronRight,
  FileText,
  Mail,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useSettings } from '@/app/providers/settings'
import { Group, Row, Flag } from '../controls'

const DOCS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/terms', label: 'Terms of Service', icon: FileText },
  { to: '/privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { to: '/educator', label: 'Educator Agreement', icon: Scale },
]

/** Privacy: a Law 25 note, links out to the (draft) legal documents, and the
 * data-rights contact path. */
export function PrivacySection() {
  const { closeSettings } = useSettings()

  return (
    <div>
      <p className="mb-5 text-[13px] leading-relaxed text-muted">
        ConcordiaTracker complies with Quebec&rsquo;s Law 25. The full documents
        below are <span className="font-medium text-warning">drafts pending review</span>{' '}
        — not finalized legal text.
      </p>

      <Group label="Legal documents">
        {DOCS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => closeSettings()}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50"
          >
            <Icon size={16} className="shrink-0 text-subtle" aria-hidden />
            <span className="text-[13px] font-medium text-fg">{label}</span>
            <Flag />
            <ChevronRight size={16} className="ml-auto shrink-0 text-subtle" aria-hidden />
          </Link>
        ))}
      </Group>

      <Group label="Your data (Law 25)">
        <Row
          label="Access, correct, or delete your data"
          description="Withdraw consent or request a copy at any time."
        />
        <a
          href="mailto:concordiatracker@gmail.com"
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/50"
        >
          <Mail size={16} className="shrink-0 text-subtle" aria-hidden />
          <span className="text-[13px] font-medium text-fg">Privacy &amp; data contact</span>
          <span className="ml-auto text-[12px] text-subtle">concordiatracker@gmail.com</span>
        </a>
      </Group>
    </div>
  )
}
