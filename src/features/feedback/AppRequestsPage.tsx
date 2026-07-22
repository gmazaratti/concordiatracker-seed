import { RequestsBoard } from './RequestsBoard'
import { PinRequestsToast } from './PinRequestsToast'

/** `/app/requests` — the feature-requests board rendered INSIDE the student app
 * shell (so the sidebar stays), reached from the opt-in pinned sidebar item.
 * The standalone /feedback page (bugs + requests tabs) is unchanged. */
export function AppRequestsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <header className="mb-5">
        <p className="text-[12px] text-subtle">Around the product</p>
        <h1 className="font-display text-[26px] leading-tight font-medium text-fg">
          Feature requests
        </h1>
        <p className="mt-1 text-[13px] text-subtle">
          Vote on ideas and suggest what we build next.
        </p>
      </header>
      <RequestsBoard />
      <PinRequestsToast />
    </div>
  )
}
