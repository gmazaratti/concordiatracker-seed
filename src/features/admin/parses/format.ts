const AGO = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const WHEN = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function ago(iso: string | null): string {
  if (!iso) return 'never'
  const s = (new Date(iso).getTime() - Date.now()) / 1000
  const a = Math.abs(s)
  if (a < 60) return 'just now'
  if (a < 3600) return AGO.format(Math.round(s / 60), 'minute')
  if (a < 86400) return AGO.format(Math.round(s / 3600), 'hour')
  return AGO.format(Math.round(s / 86400), 'day')
}

export function when(iso: string): string {
  return WHEN.format(new Date(iso))
}

export function secs(ms: number | null): string {
  if (ms == null) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function pct(part: number, whole: number): string {
  if (!whole) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

export function kb(bytes: number | null): string {
  if (bytes == null) return ''
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`
}

/** "text:33343ch" → "Extracted text", "pdf:478878b" → "PDF (model read it)". */
export function pathLabel(path: string | null): string {
  if (!path) return 'Not recorded'
  if (path.startsWith('text') && path.includes('+pdf')) return 'Text, then PDF'
  if (path.startsWith('text')) return 'Extracted text'
  if (path.startsWith('pdf')) return 'PDF (model read it)'
  if (path === 'not recorded') return 'Not recorded'
  return path
}

/** Within the last 24 hours. A helper so render code does not read the clock. */
export function withinDay(iso: string | null): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() < 86_400_000
}
