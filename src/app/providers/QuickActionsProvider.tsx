import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  QuickActionsContext,
  type QuickTarget,
  type UndoEntry,
} from './quick-actions'

const UNDO_TIMEOUT = 6000

/** Owns the two things palette actions reach for beyond navigation: a focused
 * detail popup (an assessment or a course) and a transient, reversible "Undo"
 * toast. Both are app-level so they outlive the palette that triggered them. */
export function QuickActionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [target, setTarget] = useState<QuickTarget | null>(null)
  const [undo, setUndo] = useState<UndoEntry | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const keySeq = useRef(0)

  const openAssessment = useCallback(
    (id: string) => setTarget({ kind: 'assessment', id }),
    [],
  )
  const openCourse = useCallback(
    (id: string) => setTarget({ kind: 'course', id }),
    [],
  )
  const closeTarget = useCallback(() => setTarget(null), [])

  const clearTimer = () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current)
    timer.current = undefined
  }

  const dismissUndo = useCallback(() => {
    clearTimer()
    setUndo(null)
  }, [])

  const flashUndo = useCallback((label: string, run: () => void) => {
    clearTimer()
    keySeq.current += 1
    setUndo({ key: keySeq.current, label, run })
    timer.current = window.setTimeout(() => setUndo(null), UNDO_TIMEOUT)
  }, [])

  useEffect(() => () => clearTimer(), [])

  const value = useMemo(
    () => ({
      target,
      openAssessment,
      openCourse,
      closeTarget,
      undo,
      flashUndo,
      dismissUndo,
    }),
    [target, openAssessment, openCourse, closeTarget, undo, flashUndo, dismissUndo],
  )

  return (
    <QuickActionsContext value={value}>{children}</QuickActionsContext>
  )
}
