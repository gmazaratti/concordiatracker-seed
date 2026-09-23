/**
 * The letters in an avatar when there is no picture.
 *
 * ONE FUNCTION, because there were two and they disagreed: the thread list
 * took INITIALS ("Probe Classmate" → PC) and the conversation took the first
 * two LETTERS of the same string (→ PR), so the same person had two different
 * faces on two screens that sit side by side.
 *
 * IT NEVER THROWS, which is the more important half. Both old versions read
 * `(name ?? handle).slice(...)` — and `??` only falls back on null, so a
 * profile with no name AND no handle produced `null.slice(...)`, which unmounts
 * the entire React tree and leaves a grey screen. A missing name is ordinary
 * (a row created before onboarding finished); the app disappearing over it is
 * not.
 */
export function initialsOf(name?: string | null, handle?: string | null): string {
  const source = (name ?? '').trim() || (handle ?? '').replace(/^@/, '').trim()
  if (!source) return '?'
  const words = source.split(/[\s._-]+/).filter(Boolean)
  const letters =
    words.length > 1
      ? words.slice(0, 2).map((w) => w[0])
      : // One word: two letters of it reads better than one lonely capital.
        [source[0], source[1]].filter(Boolean)
  return letters.join('').toUpperCase() || '?'
}
