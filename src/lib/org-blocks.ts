import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Clubs I have blocked, in one module-level store.
 *
 * The server already hides a blocked club's posts and stories (db/ugc_blocks.sql),
 * but a feed that only changes on the next load is not "instantly removed", so
 * every Community surface also filters through this set: block a club and its
 * posts, stories and events leave the screen in the same frame. Unlike
 * muted-orgs.ts this is a real relationship, stored on the account, so it
 * follows you between devices.
 */
export interface BlockedOrg {
  org_id: string
  handle: string
  name: string
  logo: string | null
  color: string | null
  glyph: string | null
  created_at: string
}

interface State {
  rows: BlockedOrg[]
  ids: Set<string>
  handles: Set<string>
  loaded: boolean
}

const norm = (h: string) => h.replace(/^@/, '').toLowerCase()
const build = (rows: BlockedOrg[], loaded: boolean): State => ({
  rows,
  ids: new Set(rows.map((r) => r.org_id)),
  handles: new Set(rows.map((r) => norm(r.handle))),
  loaded,
})

let state: State = build([], false)
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const set = (s: State) => {
  state = s
  for (const l of listeners) l()
}

function load() {
  if (inflight || state.loaded) return
  inflight = Promise.resolve(supabase.rpc('my_org_blocks'))
    .then(({ data, error }) => {
      if (!error) set(build((data as BlockedOrg[] | null) ?? [], true))
    })
    .finally(() => {
      inflight = null
    })
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') set(build([], false))
})

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => state

export function useOrgBlocks() {
  const s = useSyncExternalStore(subscribe, snapshot)
  useEffect(() => load(), [])
  return s
}

/** Is this club blocked? Accepts an org id or a handle (with or without @). */
export function isOrgBlocked(s: Pick<State, 'ids' | 'handles'>, idOrHandle: string | undefined | null) {
  if (!idOrHandle) return false
  return s.ids.has(idOrHandle) || s.handles.has(norm(idOrHandle))
}

/** Optimistic: the club disappears now, and comes back if the server refuses. */
export async function blockOrg(org: { id: string; handle: string; name: string }): Promise<string | null> {
  const before = state
  const row: BlockedOrg = {
    org_id: org.id,
    handle: org.handle,
    name: org.name,
    logo: null,
    color: null,
    glyph: null,
    created_at: new Date().toISOString(),
  }
  set(build([row, ...state.rows.filter((r) => r.org_id !== org.id)], state.loaded))
  const { error } = await supabase.rpc('block_org', { p_org: org.id })
  if (error) {
    set(before)
    return error.message || 'That did not go through.'
  }
  return null
}

export async function unblockOrg(orgId: string): Promise<boolean> {
  const before = state
  set(build(state.rows.filter((r) => r.org_id !== orgId), state.loaded))
  const { error } = await supabase.rpc('unblock_org', { p_org: orgId })
  if (error) set(before)
  return !error
}
