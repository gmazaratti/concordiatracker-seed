import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TourContext, type TourStep } from './tour'

/** Drives the guided tour: current step, per-step route navigation, advance/back,
 * and end (which fires the onDone passed to start). The visual layer is
 * TourOverlay; this just owns the sequence. */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [steps, setSteps] = useState<TourStep[]>([])
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(false)
  const onDoneRef = useRef<(() => void) | null>(null)

  const goRoute = useCallback(
    (step: TourStep | undefined) => {
      if (step?.route) navigate(step.route)
    },
    [navigate],
  )

  const end = useCallback(() => {
    setActive(false)
    setSteps([])
    setIndex(0)
    const done = onDoneRef.current
    onDoneRef.current = null
    done?.()
  }, [])

  const start = useCallback(
    (next: TourStep[], onDone?: () => void) => {
      if (!next.length) return
      onDoneRef.current = onDone ?? null
      setSteps(next)
      setIndex(0)
      setActive(true)
      goRoute(next[0])
    },
    [goRoute],
  )

  const next = useCallback(() => {
    const ni = index + 1
    if (ni >= steps.length) {
      end()
      return
    }
    goRoute(steps[ni])
    setIndex(ni)
  }, [index, steps, end, goRoute])

  const back = useCallback(() => {
    if (index === 0) return
    const pi = index - 1
    goRoute(steps[pi])
    setIndex(pi)
  }, [index, steps, goRoute])

  const value = useMemo(
    () => ({
      active,
      step: active ? (steps[index] ?? null) : null,
      index,
      total: steps.length,
      start,
      next,
      back,
      end,
    }),
    [active, steps, index, start, next, back, end],
  )

  return <TourContext value={value}>{children}</TourContext>
}
