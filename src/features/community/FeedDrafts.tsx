import { useEffect, useState } from 'react'
import { FilePenLine } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { loadPostDrafts, type PostDraft } from '@/lib/social-posts'
import { loadMyOrgPerms } from '@/lib/org-roles'
import { PostDrafts } from '@/features/organizer/feed/PostDrafts'
import { PostComposer } from './posts/PostComposer'
import type { PublishableOrg } from './useMyOrgs'

interface OrgDrafts {
  org: PublishableOrg
  drafts: PostDraft[]
  canPublish: boolean
}

/**
 * Your clubs' unfinished posts, reachable from the feed you wrote them in.
 *
 * "Save as draft" in the feed's composer used to save into a place only the
 * organizer portal could show — so from here it looked as if nothing had
 * been kept. The pill appears only when there is something in it; one tap
 * lists every club's drafts, and Continue editing reopens the composer on
 * the last screen with everything as it was left.
 */
export function FeedDrafts({
  orgs,
  refreshKey,
  onChanged,
}: {
  orgs: PublishableOrg[]
  refreshKey: number
  onChanged: () => void
}) {
  const [groups, setGroups] = useState<OrgDrafts[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<{ org: PublishableOrg; draft: PostDraft; canPublish: boolean } | null>(null)
  const [tick, setTick] = useState(0)
  const ids = orgs.map((o) => o.id).join(',')

  useEffect(() => {
    if (!ids) return
    let alive = true
    void Promise.all(
      orgs.map(async (org) => {
        const [drafts, perms] = await Promise.all([
          loadPostDrafts(org.id).catch(() => [] as PostDraft[]),
          loadMyOrgPerms(org.id),
        ])
        return { org, drafts, canPublish: !!perms && (perms.is_owner || perms.post_feed) }
      }),
    ).then((g) => alive && setGroups(g.filter((x) => x.drafts.length > 0)))
    return () => {
      alive = false
    }
    // `orgs` is represented by `ids`; the array itself is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, refreshKey, tick])

  const total = groups.reduce((n, g) => n + g.drafts.length, 0)
  const changed = () => {
    setTick((t) => t + 1)
    onChanged()
  }

  return (
    <>
      {total > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mx-4 mb-1 inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <FilePenLine size={14} className="text-accent" aria-hidden />
          Drafts · {total}
        </button>
      )}

      {open && (
        <ModalShell label="Drafts" onClose={() => setOpen(false)} widthClass="sm:max-w-lg">
          <div className="px-5 pt-5 pb-5">
            <h2 className="mb-3 text-[16px] font-semibold text-fg">Drafts</h2>
            {groups.length === 0 ? (
              <p className="text-[13px] text-subtle">No drafts left.</p>
            ) : (
              groups.map((g) => (
                <div key={g.org.id}>
                  {groups.length > 1 && (
                    <p className="mb-1.5 text-[12px] font-medium text-muted">{g.org.name}</p>
                  )}
                  <PostDrafts
                    drafts={g.drafts}
                    canPublish={g.canPublish}
                    onOpen={(d) => {
                      setOpen(false)
                      setEditing({ org: g.org, draft: d, canPublish: g.canPublish })
                    }}
                    onChanged={changed}
                  />
                </div>
              ))
            )}
          </div>
        </ModalShell>
      )}

      {editing && (
        <PostComposer
          orgs={[editing.org]}
          draft={editing.draft}
          canPublish={editing.canPublish}
          onClose={() => setEditing(null)}
          onPosted={changed}
        />
      )}
    </>
  )
}
