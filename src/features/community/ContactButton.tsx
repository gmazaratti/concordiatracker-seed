import { Mail } from 'lucide-react'
import { cn } from '@/lib/cn'

const CONTACT_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg'

/**
 * Contact, when there is something to contact.
 *
 * An org that publishes an address gets a real `mailto:`; one that does not
 * keeps the button that says out loud it is a stub. A dead control that looks
 * live is the worse of the two — you only find out after writing the message.
 *
 * Its own file rather than living beside the profile page: the event detail
 * needs it too, and importing it from the page would close a cycle
 * (OrgProfilePage → EventDetail → OrgProfilePage).
 */
export function ContactButton({
  org,
  className,
  onGate,
}: {
  org: { email?: string; name: string }
  className?: string
  /** Public (signed-out) mode: bounce to the signup gate instead. */
  onGate?: () => void
}) {
  if (onGate || !org.email) {
    return (
      <button
        type="button"
        onClick={onGate}
        title={org.email ? `Email ${org.name}` : 'Contact (mocked in this build)'}
        className={cn(CONTACT_CLASS, className)}
      >
        <Mail size={14} aria-hidden />
        Contact
      </button>
    )
  }
  return (
    <a
      href={`mailto:${org.email}`}
      title={`Email ${org.email}`}
      className={cn(CONTACT_CLASS, className)}
    >
      <Mail size={14} aria-hidden />
      Contact
    </a>
  )
}
