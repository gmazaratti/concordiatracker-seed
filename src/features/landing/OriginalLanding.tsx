import { useNoIndex } from '@/app/hooks/useNoIndex'
import { LandingPage } from './LandingPage'

/**
 * The previous homepage, kept live at /dev/original-landing as a rollback.
 *
 * Unchanged except for `noindex, nofollow`, so it never competes with `/` in
 * search. The served HTML carries the same directive (prerendered by
 * docs-src/agent-pages.mjs) for a crawler that does not run JavaScript. Its
 * canonical still names `/`, which is the page it is a copy of.
 *
 * The parent's effect runs after LandingPage's own, so this robots value is
 * the one that holds.
 */
export function OriginalLanding() {
  useNoIndex('noindex, nofollow')
  return <LandingPage />
}
