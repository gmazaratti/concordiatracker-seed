import { useState } from 'react'
import { ChevronRight, Link2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import type { SocialKey } from '@/data/community'
import { SocialFieldIcon } from './SocialLinks'
import { hostOf, type ProfileLink } from './social'
import { cn } from '@/lib/cn'

/** A website reads as a link; a platform reads as itself. */
function Glyph({ kind, size = 14 }: { kind: SocialKey; size?: number }) {
  if (kind === 'website') return <Link2 size={size} aria-hidden />
  return <SocialFieldIcon field={kind} size={size} />
}

/**
 * The links line on a profile — one line, under the description.
 *
 * ONE LINE, ALWAYS. The old row wrapped a website label and a strip of icon
 * squares, so a club with four links spent two rows of the profile on chrome
 * before anybody reached the events. A profile's links are a footnote to the
 * bio, not a section of their own, and the reference treats them as exactly
 * that: an icon, one piece of text, and everything else a tap away.
 *
 * ONE LINK SHOWS ITSELF. With a single link there is nothing to choose
 * between, so a sheet asking you to pick from a list of one is a step for
 * nothing — it is the link, with its icon, going straight out.
 *
 * NOTHING BETWEEN THE TAP AND THE SITE. No interstitial, no "you are leaving"
 * dialog: these are links a club published on its own profile, and a warning
 * in front of every one of them is a warning nobody reads.
 */
export function ProfileLinksRow({
  links,
  className,
}: {
  links: ProfileLink[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (links.length === 0) return null

  const one = links.length === 1 ? links[0] : null

  return (
    <>
      <div className={cn('mt-1.5 flex max-w-xl min-w-0', className)}>
        {one ? (
          <a
            href={one.href}
            target="_blank"
            rel="noreferrer noopener nofollow ugc"
            className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-info transition-opacity duration-150 hover:underline active:opacity-70"
          >
            <span className="shrink-0">
              <Glyph kind={one.kind} />
            </span>
            <span className="truncate">{one.label}</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-info transition-opacity duration-150 hover:underline active:opacity-70"
          >
            <Link2 size={14} className="shrink-0" aria-hidden />
            <span className="truncate">Links</span>
            <span className="shrink-0 text-subtle tabular-nums">{links.length}</span>
          </button>
        )}
      </div>

      {open && <LinksSheet links={links} onClose={() => setOpen(false)} />}
    </>
  )
}

function LinksSheet({ links, onClose }: { links: ProfileLink[]; onClose: () => void }) {
  return (
    <ModalShell label="Links" onClose={onClose} widthClass="sm:max-w-sm">
      <h2 className="mb-1 text-[15px] font-semibold text-fg">Links</h2>
      <ul className="-mx-1">
        {links.map((l) => (
          <li key={l.kind}>
            <a
              href={l.href}
              target="_blank"
              rel="noreferrer noopener nofollow ugc"
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-1 py-3 transition-colors duration-150 hover:bg-surface-2"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                <Glyph kind={l.kind} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-fg">{l.label}</span>
                {/* The host under the title, because a title the club wrote
                    says nothing about where it goes — and where it goes is
                    the one thing worth knowing before you tap. Skipped when
                    the label already IS the host: the same string twice reads
                    as a rendering fault. */}
                {l.label !== hostOf(l.href) && (
                  <span className="block truncate text-[12px] text-subtle">{hostOf(l.href)}</span>
                )}
              </span>
              <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </ModalShell>
  )
}
