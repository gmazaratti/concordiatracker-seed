import { useCallback, useMemo } from 'react'
import { useUiState, type UiState } from '@/app/providers/ui-state'
import { DEFAULT_REMINDER_OFFSETS, MAX_REMINDER_MINUTES, type ReminderTone } from '@/lib/reminder-copy'

export interface ReminderPrefs {
  enabled: boolean
  defaults: number[]
  tone: ReminderTone
  liveActivity: boolean
  liveWindowHours: number
}

export const LIVE_WINDOW_CHOICES = [1, 3, 6, 12, 24] as const

/** Absent keys are the defaults; nothing here is ever undefined. */
export function resolveReminderPrefs(raw: UiState['assignmentReminders']): ReminderPrefs {
  const defaults = Array.isArray(raw?.defaults)
    ? raw.defaults.filter((m) => Number.isInteger(m) && m > 0 && m <= MAX_REMINDER_MINUTES)
    : [...DEFAULT_REMINDER_OFFSETS]
  const window = raw?.liveWindowHours
  return {
    enabled: raw?.enabled !== false,
    defaults: [...new Set(defaults)].sort((a, b) => b - a),
    tone: raw?.tone === 'formal' ? 'formal' : 'cool',
    liveActivity: raw?.liveActivity !== false,
    liveWindowHours: typeof window === 'number' && window > 0 && window <= 24 ? window : 6,
  }
}

/** The student's reminder settings, and a way to change them. Cross-device:
 *  they live on the profile row, which the server also reads. */
export function useReminderPrefs(): [ReminderPrefs, (patch: Partial<ReminderPrefs>) => void] {
  const { uiState, patchUiState } = useUiState()
  const raw = uiState.assignmentReminders
  const prefs = useMemo(() => resolveReminderPrefs(raw), [raw])
  const update = useCallback(
    (patch: Partial<ReminderPrefs>) => patchUiState({ assignmentReminders: { ...raw, ...patch } }),
    [patchUiState, raw],
  )
  return [prefs, update]
}
