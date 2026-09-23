import { useEffect, useRef, useState } from 'react'
import type { EventOrg } from '@/data/community'
import { OrgProfileHeaderView } from '@/features/community/OrgProfileHeaderView'

/**
 * The width the real profile column has AT THIS VIEWPORT.
 *
 * Read off `OrgProfilePage`, not estimated: `mx-auto w-full max-w-3xl px-5
 * sm:px-6`. So it is capped at 768 and loses 40px of gutter below `sm` and
 * 48 above it. Computing it rather than picking one number is what makes the
 * preview right at every width instead of only at a desktop one — the banner
 * is a different shape on a phone, and that shape was the question.
 */
function pageWidth(): number {
  const vw = window.innerWidth
  return Math.min(768, vw) - (vw >= 640 ? 48 : 40)
}

/**
 * What a visitor sees, rendered by the component a visitor gets.
 *
 * THE PROMISE IS 1:1, so this does not draw a small version of the profile —
 * it mounts `OrgProfileHeaderView`, the same component the public page mounts,
 * at the width the public page gives it, and scales the whole thing down to
 * fit whatever room the wizard has. Every proportion is therefore the page's
 * own, including the banner height that prompted the question.
 *
 * THE WIDTH IS COMPUTED FROM THE VIEWPORT, not fixed. Tailwind's `sm:` rules
 * key off the viewport, so on a phone the header is already laying itself out
 * in its mobile form — what it also needs is the width a phone gives it, or
 * the banner comes out a different shape from the real one. `pageWidth()` is
 * the profile column's own arithmetic, so the preview is a true 1:1 at any
 * screen rather than only at a desktop.
 *
 * INERT, because it is a picture. Every button inside is the real button with
 * the real styling; none of them do anything, so nobody accidentally follows
 * their own club from inside a setup wizard.
 */
export function ProfilePreview({ org }: { org: EventOrg }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number | null>(null)
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 720 : pageWidth(),
  )

  useEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return
    const measure = () => {
      // The CONTENT width, not clientWidth: clientWidth includes the box's
      // own padding, so the header was scaled for 24px more room than it had
      // and sat nudged right, its banner running under the card's edge.
      const cs = getComputedStyle(box)
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const rendered = pageWidth()
      setWidth(rendered)
      // Only ever shrink. Blowing a 335px phone layout up to fill a desktop
      // column would be a picture of a screen nobody has.
      const k = Math.min(1, avail / rendered)
      setScale(k)
      setHeight(inner.offsetHeight * k)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    ro.observe(inner)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [org])

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-canvas">
      {/* NO BROWSER CHROME. The traffic lights and a URL bar said "this is a
          desktop browser" on a phone, where it is not — the preview is the
          profile as it lays out on THIS device, and nothing else. */}
      <div ref={boxRef} className="px-3 py-3" style={height ? { height: height + 24 } : undefined}>
        <div
          inert
          className="pointer-events-none origin-top-left"
          style={{ width, transform: scale === 1 ? undefined : `scale(${scale})` }}
        >
          <div ref={innerRef}>
            <OrgProfileHeaderView
              org={org}
              followers={0}
              posts={0}
              upcoming={0}
              /* A VISITOR'S view, so Message is shown. `mine` hides it, and
                 from inside your own setup `mine` would be true — which is
                 the one thing that would make this not a visitor's view. */
              mine={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
