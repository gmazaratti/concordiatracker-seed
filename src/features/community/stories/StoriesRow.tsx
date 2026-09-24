import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { StoryRing } from '@/lib/social-posts'
import type { PublishableOrg } from '../useMyOrgs'
import { FallbackImg } from '@/components/ui/FallbackImg'

/**
 * The row of rings at the top of the feed.
 *
 * A HORIZONTAL SCROLLER, and deliberately not a wrapping grid. The row is a
 * queue you work through left to right; wrapping it turns a glance into a
 * block of the screen and buries the feed the page exists for.
 *
 * "Your story" only appears for somebody who runs a club. A plus button that
 * cannot do anything is worse than no button — and posting here is an
 * organisation speaking, not a student.
 */
export function StoriesRow({
  rings,
  myOrgs,
  onOpen,
  onCompose,
}: {
  rings: StoryRing[]
  myOrgs: PublishableOrg[]
  onOpen: (orgId: string) => void
  onCompose: () => void
}) {
  const canPost = myOrgs.length > 0
  if (rings.length === 0 && !canPost) return null

  return (
    <div className="-mx-4 mb-3 sm:mx-0">
      <ul className="flex gap-3.5 overflow-x-auto px-4 pb-1 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {canPost && (
          <li className="shrink-0">
            <button
              type="button"
              onClick={onCompose}
              className="group flex w-[68px] flex-col items-center gap-1.5"
            >
              <span className="relative">
                <Ring seen>
                  <Face
                    logo={myOrgs[0].logo}
                    glyph={myOrgs[0].glyph}
                    color={myOrgs[0].color}
                    name={myOrgs[0].name}
                  />
                </Ring>
                <span className="absolute right-0 bottom-0 grid size-5 place-items-center rounded-full border-2 border-canvas bg-accent text-accent-contrast">
                  <Plus size={11} strokeWidth={3} aria-hidden />
                </span>
              </span>
              <span className="w-full truncate text-center text-[11px] text-muted group-hover:text-fg">
                Your story
              </span>
            </button>
          </li>
        )}

        {rings.map((r) => (
          <li key={r.orgId} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(r.orgId)}
              className="group flex w-[68px] flex-col items-center gap-1.5"
              aria-label={`${r.name}, ${r.unseen > 0 ? `${r.unseen} new` : 'watched'}`}
            >
              <Ring seen={r.unseen === 0}>
                <Face logo={r.logo} glyph={r.glyph} color={r.color} name={r.name} />
              </Ring>
              <span
                className={cn(
                  'w-full truncate text-center text-[11px]',
                  r.unseen > 0 ? 'text-fg' : 'text-subtle',
                )}
              >
                {r.handle.replace(/^@/, '')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Unseen gets the gradient; watched gets a flat border. The gap between them
 *  is the whole message, so it is a different KIND of edge and not a shade. */
function Ring({ seen, children }: { seen: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'grid size-[62px] place-items-center rounded-full p-[2.5px] transition-transform duration-150 group-active:scale-95',
        seen ? 'bg-border' : 'ct-story-ring',
      )}
    >
      <span className="grid size-full place-items-center rounded-full bg-canvas p-[2px]">
        {children}
      </span>
    </span>
  )
}

function Face({
  logo,
  glyph,
  color,
  name,
}: {
  logo: string | null
  glyph: string | null
  color: string | null
  name: string
}) {
  /* The initials are the BASE and the logo sits over them — they used to be
     the other branch of an `if`, so a dead URL that hid itself left a hole
     rather than the fallback the comment promised. */
  return (
    <span
      className="relative grid size-full place-items-center overflow-hidden rounded-full text-[15px] font-semibold text-white"
      style={{ background: color ?? '#4b5563' }}
    >
      {(glyph || name.slice(0, 2)).toUpperCase()}
      <FallbackImg src={logo} className="absolute inset-0 size-full object-cover" />
    </span>
  )
}
