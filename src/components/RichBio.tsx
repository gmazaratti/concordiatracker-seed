import { parseBio } from '@/lib/bio-links'
import { cn } from '@/lib/cn'

/**
 * A bio, with its links live.
 *
 * `parseBio` decides what is a link; this only draws. Nothing here builds an
 * href from user text — it renders the ones the parser has already vouched
 * for, which is why there is no `dangerouslySetInnerHTML` anywhere near it.
 *
 * `nofollow ugc` on every one: this is somebody else's text on our domain,
 * and passing our ranking to whatever a club pastes is not a thing we mean to
 * do. `noreferrer` because where you came from is not the destination's
 * business.
 */
export function RichBio({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null
  const nodes = parseBio(text)
  return (
    <p className={cn('whitespace-pre-line', className)}>
      {nodes.map((n, i) =>
        n.kind === 'link' ? (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noreferrer noopener nofollow ugc"
            className="font-medium text-info underline-offset-2 hover:underline"
          >
            {n.text}
          </a>
        ) : (
          <span key={i}>{n.text}</span>
        ),
      )}
    </p>
  )
}
