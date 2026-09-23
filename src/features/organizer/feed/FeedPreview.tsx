import { useEffect, useMemo } from 'react'
import { Bell, Search, Settings, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { STUDENT_NAV } from '@/app/navigation'
import { useT } from '@/i18n/i18n'
import { Logo } from '@/components/Logo'
import { PostCard } from '@/features/community/posts/PostCard'
import { StoriesRow } from '@/features/community/stories/StoriesRow'
import { COMMUNITY_SECTIONS } from '@/features/community/sections'
import { demoFillerPosts } from '@/lib/demo-org'
import type { FeedPost, StoryRing } from '@/lib/social-posts'
import type { EventOrg } from '@/data/community'
import { cn } from '@/lib/cn'

const noop = () => undefined

/**
 * Your posts, inside the app a student actually has open.
 *
 * WHAT IT IS: the student shell — the sidebar with its tabs, your name and the
 * settings button, the stories bar, the phone's top and bottom bars — around
 * the real `PostCard`, with made-up clubs' posts above and below yours so the
 * thing scrolls like a feed instead of ending after two cards. Asking "how does
 * this look" of a column that holds only your own posts answers a question
 * nobody will ever see.
 *
 * NOTHING IN IT DOES ANYTHING. Every region is `inert` (unfocusable and
 * unclickable) except the one control that leaves. The scroll container
 * itself is not inert, so the wheel and a finger still scroll it.
 *
 * The filler clubs are invented and say so nowhere on screen, because a label
 * on each would make it look less like the feed — which is the point of the
 * page. They are never real organisations.
 */
export function FeedPreview({
  posts,
  org,
  onClose,
}: {
  posts: FeedPost[]
  org: EventOrg
  onClose: () => void
}) {
  const { user } = useAppData()
  const t = useT()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const filler = useMemo(() => demoFillerPosts(), [])
  // Somebody else's first, then yours, then more: the feed does not start
  // with you, and it does not end with you either.
  const feed = useMemo(() => [...filler.slice(0, 2), ...posts, ...filler.slice(2)], [filler, posts])
  const rings = useMemo<StoryRing[]>(() => {
    const at = new Date().toISOString()
    const ring = (p: Pick<FeedPost, 'orgId' | 'handle' | 'orgName' | 'logo' | 'color' | 'glyph'>, unseen: number): StoryRing => ({
      orgId: p.orgId, handle: p.handle, name: p.orgName, logo: p.logo, color: p.color, glyph: p.glyph,
      verified: true, total: 1, unseen, latestAt: at, cover: null,
    })
    const mine = ring({ orgId: 'preview-self', handle: org.handle, orgName: org.name, logo: org.logo ?? null, color: org.color, glyph: org.glyph }, 1)
    return [mine, ...filler.map((p, i) => ring(p, i < 2 ? 1 : 0))]
  }, [filler, org])

  return (
    <div className="ct-animate-fade fixed inset-0 z-[70] flex flex-col bg-canvas">
      <div className="flex shrink-0 items-center gap-3 border-b border-accent/40 bg-accent-soft px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-accent-contrast uppercase">
          Preview
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
          What a student sees. Nothing here can be clicked.
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <X size={13} aria-hidden />
          Exit preview
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* The student app's desktop rail, as it looks on the Social tab. */}
        <aside inert className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/40 p-3 md:flex">
          <div className="px-2 pt-1 pb-3">
            <Logo />
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-subtle">
            <Search size={15} aria-hidden />
            Search
          </div>
          <nav className="flex flex-col gap-1">
            {STUDENT_NAV.map((n) => {
              const on = n.to === '/app/community'
              return (
                <div key={n.to}>
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                      on ? 'bg-accent-soft font-medium text-fg' : 'text-muted',
                    )}
                  >
                    <n.icon size={18} className={on ? 'text-accent' : 'text-subtle'} aria-hidden />
                    {t(n.labelKey)}
                  </div>
                  {on && (
                    <div className="mt-0.5 mb-1 ml-[26px] border-l border-border pl-2">
                      {COMMUNITY_SECTIONS.map((s) => (
                        <div
                          key={s.id}
                          className={cn(
                            'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]',
                            s.id === 'feed' ? 'bg-accent-soft font-medium text-fg' : 'text-muted',
                          )}
                        >
                          <s.icon size={13} className={s.id === 'feed' ? 'text-accent' : 'text-subtle'} aria-hidden />
                          {s.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
          <div className="flex-1" />
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Face name={user.name} initials={user.initials} src={user.avatarUrl} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{user.name}</span>
            <Bell size={17} className="text-muted" aria-hidden />
            <Settings size={17} className="text-muted" aria-hidden />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* The phone's top bar. */}
          <div inert className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 md:hidden">
            <Logo />
            <div className="flex items-center gap-3 text-muted">
              <Search size={19} aria-hidden />
              <Face name={user.name} initials={user.initials} src={user.avatarUrl} />
            </div>
          </div>

          {/* The one region that is not inert: it has to scroll. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-[470px] pt-3 pb-8">
              <div inert>
                <StoriesRow rings={rings} myOrgs={[]} onOpen={noop} onCompose={noop} />
              </div>
              <div inert className="mt-3 flex flex-col gap-5 px-4">
                {feed.map((p) => (
                  <PostCard key={p.id} post={p} onChanged={noop} />
                ))}
              </div>
            </div>
          </div>

          {/* The phone's bottom bar. */}
          <nav inert className="flex shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
            {STUDENT_NAV.map((n) => (
              <div
                key={n.to}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                  n.to === '/app/community' ? 'text-accent' : 'text-subtle',
                )}
              >
                <n.icon size={20} aria-hidden />
                {t(n.labelKey)}
              </div>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

function Face({ name, initials, src }: { name: string; initials: string; src?: string | null }) {
  return src ? (
    <img src={src} alt={name} referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
      {initials}
    </span>
  )
}
