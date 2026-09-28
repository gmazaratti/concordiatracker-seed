/**
 * Decide what an installed native build should see, from /api/app-version.
 *
 * PURE and import-free, so it is Node-tested (version-gate.test.mjs). The
 * rule the whole feature rests on lives here: anything unexpected is 'ok'.
 * A malformed answer, a missing build number, a store URL that is not the
 * App Store: none of those may stop the app launching.
 */

export type VersionGate =
  | { kind: 'ok' }
  /** Below the minimum: a full-screen update prompt with no way past it. */
  | { kind: 'block'; storeUrl: string }
  /** Below the latest but supported: a banner that can be dismissed. */
  | { kind: 'soft'; storeUrl: string; latest: number }

const OK: VersionGate = { kind: 'ok' }

/** Only an App Store link may sit behind the button, whatever the server says. */
function storeLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.hostname === 'apps.apple.com' ? u.href : null
  } catch {
    return null
  }
}

function build(raw: unknown): number | null {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : null
}

export function versionGate(installedRaw: unknown, info: unknown): VersionGate {
  const installed = build(installedRaw)
  if (installed === null || !info || typeof info !== 'object') return OK
  const i = info as Record<string, unknown>
  const min = build(i.minBuild)
  const latest = build(i.latestBuild)
  const storeUrl = storeLink(i.storeUrl)
  if (min === null || latest === null || storeUrl === null || min > latest) return OK
  if (installed < min) return { kind: 'block', storeUrl }
  if (installed < latest) return { kind: 'soft', storeUrl, latest }
  return OK
}

/** The App Store app's own scheme, so the button opens the store rather than a web page. */
export function nativeStoreLink(storeUrl: string): string {
  return storeUrl.replace(/^https:\/\//, 'itms-apps://')
}
