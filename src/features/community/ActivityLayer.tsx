import { useSearchParams } from 'react-router-dom'
import { ActivityPanel } from './ActivityPanel'

/**
 * The notifications panel, over whatever page you are on.
 *
 * It used to live inside Community, so every bell, toast and widget link had
 * to navigate to Community first and the panel opened over the Feed, wherever
 * you had pressed it. Mounted in the app shell now, it opens in place:
 * `?activity=1` on ANY /app address is the panel's address (see
 * `activityHref`). Closing it removes the param and leaves you exactly where
 * you were, and Back still behaves.
 */
export function ActivityLayer() {
  const [params, setParams] = useSearchParams()
  if (params.get('activity') !== '1') return null
  return (
    <ActivityPanel
      onClose={() => {
        const p = new URLSearchParams(params)
        p.delete('activity')
        setParams(p, { replace: true })
      }}
    />
  )
}
