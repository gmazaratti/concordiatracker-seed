import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type HandleState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'free' }
  | { kind: 'taken'; why: string }

/**
 * Is this handle claimable?
 *
 * THE ANSWER COMES FROM THE DATABASE, not from a copy of the rules. Length,
 * character set, the reserved aliases and the blocklist all live in
 * `ct_handle_ok`, and `org_handle_problem` adds the two "already has it"
 * cases — so a second implementation here would be a second opinion, and the
 * one the save actually obeys is the server's.
 *
 * DEBOUNCED at 300ms and guarded by a generation counter: a slow reply for
 * "conc" must not overwrite a fast one for "concordiarobotics", which is the
 * way this sort of field tells people the wrong thing.
 *
 * A NETWORK FAILURE READS AS `idle`, not as free. Saying "available" because
 * we could not ask is how somebody gets to the end of setup and then fails on
 * a unique violation; the unique index is the real gate either way.
 */
export function useHandleCheck(handle: string, orgId?: string, skip = false): HandleState {
  const bare = handle.trim().replace(/^@+/, '')
  const eligible = !skip && bare.length >= 3
  /* KEYED BY THE HANDLE IT ANSWERS. Holding a bare state would mean the
     effect had to reset it to "idle" synchronously on every keystroke, which
     is a setState in an effect body; keeping the question alongside the
     answer means anything we have not answered yet simply reads as checking. */
  const [answer, setAnswer] = useState<{ for: string; state: HandleState } | null>(null)

  useEffect(() => {
    if (!eligible) return
    let alive = true
    const id = setTimeout(() => {
      void supabase
        .rpc('org_handle_problem', { p_handle: bare, p_org: orgId ?? null })
        .then(({ data, error }) => {
          if (!alive) return
          if (error) {
            // Could not ask. "Available" would be a guess, and the one that
            // fails at save time — the unique index is the real gate.
            setAnswer({ for: bare, state: { kind: 'idle' } })
            return
          }
          const why = typeof data === 'string' ? data : null
          setAnswer({ for: bare, state: why ? { kind: 'taken', why } : { kind: 'free' } })
        })
    }, 300)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [bare, orgId, eligible])

  if (!eligible) return { kind: 'idle' }
  return answer?.for === bare ? answer.state : { kind: 'checking' }
}

/** What a handle looks like once it is one: lower case, no sign, no spaces. */
export function tidyHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20)
}
