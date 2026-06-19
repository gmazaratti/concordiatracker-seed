import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import {
  addComment,
  adminDeleteRequest,
  adminModerateRequest,
  listCommentCounts,
  listFeatureRequests,
  listReactions,
  summarizeReactions,
  toggleReaction,
  totalReactions,
  type FeatureRequest,
  type ReactionRow,
  type Sort,
} from './feedback-data'
import { RequestComposer } from './RequestComposer'
import { RequestCard, type ModeratePatch } from './RequestCard'
import { RequestDetail } from './RequestDetail'
import { useAuth } from '@/app/providers/auth'
import { useAppData } from '@/app/providers/app-data'
import { useIsAdmin } from '@/features/admin/admin-data'
import { Select } from '@/components/ui/Select'

export function RequestsBoard() {
  const { user } = useAuth()
  const { user: profile } = useAppData()
  const { isAdmin } = useIsAdmin()
  const [params, setParams] = useSearchParams()

  const [requests, setRequests] = useState<FeatureRequest[]>([])
  const [reactionRows, setReactionRows] = useState<ReactionRow[]>([])
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('top')
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [reqs, rx, cc] = await Promise.all([listFeatureRequests(), listReactions(), listCommentCounts()])
        if (active) {
          setRequests(reqs)
          setReactionRows(rx)
          setCounts(cc)
          setErr(null)
        }
      } catch (e) {
        if (active) setErr(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [tick])

  const myName = profile.name || 'You'
  const myAvatar = profile.avatarUrl
  const myUserId = user?.id ?? null

  const toggle = async (requestId: string, emoji: string) => {
    if (!user) return
    const uid = user.id
    const mine = reactionRows.some((r) => r.request_id === requestId && r.user_id === uid && r.emoji === emoji)
    setReactionRows((prev) =>
      mine
        ? prev.filter((r) => !(r.request_id === requestId && r.user_id === uid && r.emoji === emoji))
        : [...prev, { request_id: requestId, user_id: uid, emoji }],
    )
    try {
      await toggleReaction(requestId, emoji)
    } catch {
      reload()
    }
  }

  const bumpCount = (requestId: string, delta: number) =>
    setCounts((prev) => new Map(prev).set(requestId, Math.max(0, (prev.get(requestId) ?? 0) + delta)))

  const comment = async (requestId: string, body: string) => {
    bumpCount(requestId, 1)
    try {
      await addComment(requestId, body)
    } catch {
      reload()
    }
  }

  const moderate = async (r: FeatureRequest, patch: ModeratePatch) => {
    try {
      await adminModerateRequest(r.id, { pinned: r.pinned, hidden: r.hidden, status: r.status, ...patch })
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
    }
  }
  const remove = async (id: string) => {
    try {
      await adminDeleteRequest(id)
      reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
    }
  }

  const sorted = [...requests].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (sort === 'top') {
      return totalReactions(reactionRows, b.id) - totalReactions(reactionRows, a.id) || +new Date(b.created_at) - +new Date(a.created_at)
    }
    return +new Date(b.created_at) - +new Date(a.created_at)
  })

  const openId = params.get('request')
  const openRequest = openId ? (requests.find((r) => r.id === openId) ?? null) : null
  const open = (id: string) =>
    setParams((p) => {
      p.set('request', id)
      return p
    })
  const closeDetail = () =>
    setParams((p) => {
      p.delete('request')
      return p
    })

  return (
    <div className="space-y-4">
      {user ? (
        <RequestComposer myName={myName} myAvatar={myAvatar} onSubmitted={reload} />
      ) : (
        <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] text-subtle">
          Sign in to suggest a feature, react, and comment.
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-subtle">
          {loading ? 'Loading…' : `${requests.length} request${requests.length === 1 ? '' : 's'}`}
        </p>
        <Select
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={[{ value: 'top', label: 'Most popular' }, { value: 'new', label: 'Newest' }]}
          ariaLabel="Sort requests"
          size="sm"
          tone="control"
        />
      </div>

      {err && <p className="text-[12px] text-danger">{err}</p>}

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-subtle">
          No requests yet — be the first to suggest one.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              reactions={summarizeReactions(reactionRows, r.id, myUserId)}
              commentCount={counts.get(r.id) ?? 0}
              canReact={!!user}
              canComment={!!user}
              isAdmin={isAdmin}
              myName={myName}
              myAvatar={myAvatar}
              onToggleReaction={(e) => toggle(r.id, e)}
              onOpen={() => open(r.id)}
              onModerate={(patch) => moderate(r, patch)}
              onDelete={() => remove(r.id)}
              onAddComment={(body) => comment(r.id, body)}
            />
          ))}
        </ul>
      )}

      {openRequest && (
        <RequestDetail
          r={openRequest}
          reactions={summarizeReactions(reactionRows, openRequest.id, myUserId)}
          canReact={!!user}
          canComment={!!user}
          isAdmin={isAdmin}
          myUserId={myUserId}
          myName={myName}
          myAvatar={myAvatar}
          onToggleReaction={(e) => toggle(openRequest.id, e)}
          onModerate={(patch) => moderate(openRequest, patch)}
          onDelete={() => remove(openRequest.id)}
          onClose={closeDetail}
          onCommentCountChange={(delta) => bumpCount(openRequest.id, delta)}
        />
      )}
    </div>
  )
}
