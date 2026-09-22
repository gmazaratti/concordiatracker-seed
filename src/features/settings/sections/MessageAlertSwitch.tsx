import { useState } from 'react'
import { Row, Switch } from '../controls'
import {
  alertsEnabled,
  canNotify,
  enableAlerts,
  notifyPermission,
  setAlertsEnabled,
} from '@/lib/message-alerts'

/**
 * A desktop notification when a message arrives and you are looking at
 * something else.
 *
 * SEPARATE FROM THE PUSH TOGGLE next to it, and the difference is worth
 * stating rather than merging them: push is the server reaching a CLOSED app
 * and needs a subscription stored against the device. This one is the open
 * tab raising a notification itself, which needs nothing but permission and
 * works the moment it is switched on.
 *
 * Permission is only asked when you turn it ON. Asking on page load is how
 * browsers end up with a permanently denied permission and no way back.
 */
export function MessageAlertSwitch() {
  const supported = canNotify()
  const [on, setOn] = useState(() => alertsEnabled() && notifyPermission() === 'granted')
  const [denied, setDenied] = useState(() => notifyPermission() === 'denied')

  const toggle = async (next: boolean) => {
    if (!next) {
      setAlertsEnabled(false)
      setOn(false)
      return
    }
    const r = await enableAlerts()
    setOn(r === 'granted')
    setDenied(r === 'denied')
  }

  return (
    <Row
      label="Desktop notifications for messages"
      description={
        !supported
          ? 'This browser does not support notifications.'
          : denied
            ? 'Blocked for this site. Turn notifications back on in your browser settings, then switch this on.'
            : 'Shows a notification when a message arrives and the app is not the tab you are looking at.'
      }
    >
      {/* The shared Switch has no disabled state, and adding one for this
          single case would change a control every settings row uses. When
          it cannot work, the row says why and the toggle simply refuses. */}
      <Switch
        checked={on}
        onChange={(v) => {
          if (!supported || denied) return
          void toggle(v)
        }}
        label="Desktop notifications for messages"
      />
    </Row>
  )
}
