import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Row, Switch } from '../controls'

/**
 * Which bell notifications also PUSH (to the phone app and to browsers that
 * turned notifications on). They always appear in the bell either way: these
 * decide only whether the phone buzzes.
 *
 * Stored in `user_profile.push_prefs` and read by the server's claim
 * (db/native_push.sql), so what this screen says is what the sender does.
 * A missing key means on, which is also why every switch starts on.
 */
type Category = 'club_posts' | 'follows' | 'feature_requests'

const ROWS: { id: Category; label: string; description: string }[] = [
  {
    id: 'club_posts',
    label: 'Club posts',
    description: 'A club you follow posts something new.',
  },
  {
    id: 'follows',
    label: 'New followers',
    description: 'Someone starts following you.',
  },
  {
    id: 'feature_requests',
    label: 'Feature request updates',
    description: 'A request you posted, liked or commented on changes status or gets a reply.',
  },
]

export function PushTypeSwitches() {
  const [prefs, setPrefs] = useState<Partial<Record<Category, boolean>>>({})

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user || !alive) return
      const { data } = await supabase
        .from('user_profile')
        .select('push_prefs')
        .eq('user_id', me.user.id)
        .maybeSingle()
      // Absent column (migration not run) or absent row both read as "all on".
      if (alive) setPrefs(((data as { push_prefs?: Record<Category, boolean> } | null)?.push_prefs) ?? {})
    })()
    return () => {
      alive = false
    }
  }, [])

  const set = (id: Category, on: boolean) => {
    const before = prefs
    setPrefs({ ...prefs, [id]: on })
    void supabase.rpc('set_push_pref', { p_category: id, p_on: on }).then(({ error }) => {
      // Put the switch back rather than show a setting that did not save.
      if (error) setPrefs(before)
    })
  }

  return (
    <>
      {ROWS.map((r) => (
        <Row key={r.id} label={r.label} description={r.description}>
          <Switch checked={prefs[r.id] !== false} onChange={(on) => set(r.id, on)} label={r.label} />
        </Row>
      ))}
    </>
  )
}
