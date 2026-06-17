import { EventsFeed } from './EventsFeed'

/** Community — "what's happening around me that isn't my own coursework." A pure,
 * outward-facing events aggregator (NOT a social feed): no posts, reactions, RSVP,
 * or friends. Cross-course teacher announcements live on Today, not here. */
export function CommunityPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <header className="mb-4">
        <p className="text-[12px] text-subtle">Around campus</p>
        <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
          Community
        </h1>
        <p className="mt-0.5 text-[13px] text-subtle">
          Events, fairs, and deadlines around Concordia — beyond your own coursework.
        </p>
      </header>

      <EventsFeed />
    </div>
  )
}
