import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Group, Row, Switch } from '../controls'

/**
 * Settings → Developer → Admin notifications: which platform events reach your
 * phone (db/admin_alerts.sql). Everything is ON until you turn it off, and a
 * missing preference means on, so a kind added later reaches you by default.
 *
 * Saves on the tap, optimistically, and puts the switch back if the database
 * refuses: a toggle that looks changed but did not save is how an admin stops
 * getting ticket alerts without knowing it.
 */
const ALERTS: { key: string; label: string; description: string }[] = [
  { key: 'tickets', label: 'New support tickets', description: 'One notification per ticket, with who sent it.' },
  { key: 'scan_failures', label: 'Failed syllabus scans', description: 'A student hit a wall. Retry it from Parses.' },
  { key: 'signups', label: 'New signups', description: 'Name and email of each new account.' },
  { key: 'orgs', label: 'New organizations', description: 'A club waiting for your approval.' },
  { key: 'requests', label: 'Access requests', description: 'Teacher and organizer applications, in the summary.' },
  { key: 'scans', label: 'Successful syllabus scans', description: 'Named when there are a few, summed when there are many.' },
  { key: 'feedback', label: 'Feedback and bug reports', description: 'Folded into one summary notification.' },
]

export function AdminAlertsGroup() {
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void supabase.rpc('my_admin_alert_prefs').then(({ data, error: e }) => {
      if (!alive) return
      if (e) setError('Could not load your alert settings.')
      else setPrefs((data ?? {}) as Record<string, boolean>)
    })
    return () => {
      alive = false
    }
  }, [])

  async function toggle(key: string, on: boolean) {
    setPrefs((p) => ({ ...(p ?? {}), [key]: on }))
    setError('')
    const { error: e } = await supabase.rpc('set_admin_alert_pref', { p_key: key, p_on: on })
    if (e) {
      setPrefs((p) => ({ ...(p ?? {}), [key]: !on }))
      setError('That did not save. Try again.')
    }
  }

  return (
    <Group label="Admin notifications">
      {ALERTS.map((a) => (
        <Row key={a.key} label={a.label} description={a.description}>
          <Switch
            checked={prefs ? prefs[a.key] !== false : true}
            disabled={prefs === null}
            onChange={(v) => void toggle(a.key, v)}
            label={a.label}
          />
        </Row>
      ))}
      <p className="px-4 pt-1 pb-3 text-[11.5px] leading-relaxed text-subtle">
        Sent to every device where you allowed notifications (the iPhone app and any browser).
        Checked every 15 minutes.
        {error && <span className="ml-1 text-danger">{error}</span>}
      </p>
    </Group>
  )
}
