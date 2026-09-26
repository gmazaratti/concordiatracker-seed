import { useEffect, useState } from 'react'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { Group, Row, Switch } from '../controls'

/**
 * The per-account analytics switch (db/product_analytics.sql).
 *
 * ON by default. Turning it off is enforced in the database, not here: the
 * server stops recording product events for this account, detaches the
 * account from page views (a trigger on site_events, so it holds whatever the
 * browser sends), and deletes what was already recorded. The switch says all
 * three, because "stop" and "stop and forget" are different promises.
 *
 * Page views are still COUNTED, anonymously, exactly the way a signed-out
 * visitor is counted. That is also said, so nobody believes the switch does
 * more than it does.
 */
export function AnalyticsSetting() {
  const { user } = useAuth()
  const [shared, setShared] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true
    supabase
      .from('user_profile')
      .select('analytics_opt_out')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (!active) return
        // An unrun migration hides the switch rather than showing one that lies.
        if (!e) {
          setShared(!(data as { analytics_opt_out?: boolean } | null)?.analytics_opt_out)
          setLoaded(true)
        }
      })
    return () => {
      active = false
    }
  }, [user])

  if (!loaded) return null

  async function change(next: boolean) {
    const prev = shared
    setShared(next)
    setError('')
    const { error: e } = await supabase.rpc('set_analytics_opt_out', { p_on: !next })
    if (e) {
      setShared(prev)
      setError('That did not save. Try again.')
    }
  }

  return (
    <Group label="Product analytics">
      <Row
        label="Share how I use ConcordiaTracker"
        description={
          shared
            ? 'Records which features you use and when you reach milestones like adding a first course, linked to your account, so we can see what helps. Never your grades, messages or files.'
            : 'Off. Nothing about how you use the app is recorded against your account, and what was recorded before has been deleted. Pages you open are still counted anonymously, the way a signed-out visitor is.'
        }
      >
        <Switch checked={shared} onChange={(v) => void change(v)} label="Share how I use ConcordiaTracker" />
      </Row>
      {error && (
        <p role="alert" className="px-4 pb-3 text-[12px] text-danger">
          {error}
        </p>
      )}
    </Group>
  )
}
