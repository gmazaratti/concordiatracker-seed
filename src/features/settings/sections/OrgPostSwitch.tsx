import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Row, Switch } from '../controls'

/**
 * "Tell me when a club I follow posts."
 *
 * ON BY DEFAULT, and the description says why rather than leaving someone to
 * wonder why they are hearing from anyone: following a club has exactly one
 * meaning, and a follow that produces nothing until you open the right tab is
 * a follow that did nothing.
 *
 * Optimistic, then written. Failures are swallowed the way the rest of this
 * panel swallows them — an unrun migration should cost a toggle, not the page.
 */
export function OrgPostSwitch() {
  const [on, setOn] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user || !alive) return
      const { data } = await supabase
        .from('user_profile')
        .select('notify_org_posts')
        .eq('user_id', me.user.id)
        .maybeSingle()
      if (!alive) return
      // Absent column or absent row both mean "the default", which is on.
      setOn((data as { notify_org_posts?: boolean } | null)?.notify_org_posts !== false)
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <Row
      label="New posts from clubs you follow"
      description="A club posting is the reason to follow one, so this starts on. Stories are never notified — they are on the ring at the top of the feed."
    >
      <Switch
        checked={on}
        label="New posts from clubs you follow"
        onChange={(v) => {
          setOn(v)
          void (async () => {
            const { data: me } = await supabase.auth.getUser()
            if (!me.user) return
            await supabase
              .from('user_profile')
              .update({ notify_org_posts: v })
              .eq('user_id', me.user.id)
          })()
        }}
      />
    </Row>
  )
}
