import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import { TourContext, type TourStep } from './tour'

/** Drives the guided tour: current step, per-step route navigation, advance/back,
 * and end (which fires the onDone passed to start). It also owns the sandbox
 * lifecycle — a throwaway DEMO course is merged in for the duration so the
 * walkthrough never touches real data. The visual layer is TourOverlay. */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { startSample, stopSample } = useAppData()
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
    // Land on Today before tearing down the sample, so skipping while on the DEMO
    // course detail never leaves the user on a now-missing route.
    navigate('/app')
    stopSample()
    const done = onDoneRef.current
    onDoneRef.current = null
    done?.()
  }, [navigate, stopSample])

  const start = useCallback(
    (next: TourStep[], onDone?: () => void) => {
      if (!next.length) return
      onDoneRef.current = onDone ?? null
      setSteps(next)
      setIndex(0)
      setActive(true)
      startSample()
      goRoute(next[0])
    },
    [goRoute, startSample],
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
