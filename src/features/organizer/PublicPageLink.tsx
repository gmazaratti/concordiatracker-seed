import { useState } from 'react'
import { Check, Copy, Globe } from 'lucide-react'
import { orgSlug, type EventOrg } from '@/data/community'

/**
 * The club's public page — the one search engines index and anyone can open
 * without an account. Shown so a club can put it in its Instagram bio: one
 * link from the club itself does more for it appearing in search than anything
 * on our side.
 *
 * Built from the SAVED handle, not the one being typed, so the link shown is
 * always one that works.
 */
export function PublicPageLink({ org }: { org: EventOrg }) {
  const [copied, setCopied] = useState(false)
  const url = `https://concordiatracker.com/c/${orgSlug(org)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* The text is selectable, so a refused clipboard costs nothing. */
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
        <Globe size={14} aria-hidden className="text-subtle" />
        Your public page
      </p>
      <p className="mt-0.5 text-[12px] text-subtle">
        Anyone can open it, no account needed, and it can show up when people search for your club. Put it in
        your Instagram bio.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[12.5px] text-fg select-all hover:underline"
        >
          {url.replace('https://', '')}
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
