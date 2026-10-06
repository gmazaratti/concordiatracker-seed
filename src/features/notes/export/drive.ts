/**
 * Save a note to Google Drive as a Google Doc.
 *
 * Straight from the browser to Google: Google's own sign-in library asks the
 * student for access with the `drive.file` scope, which reaches ONLY files this
 * app creates (never the rest of their Drive), and the note goes up as the same
 * .docx the Word export builds, which Drive converts into a Google Doc, header,
 * footer and page numbers included. Nothing passes through our servers and no
 * token is stored: it lives in memory for this tab and Google expires it in an
 * hour.
 *
 * Needs, in the Google Cloud project that owns the client ID: the Drive API
 * enabled, this site's origin under "Authorized JavaScript origins", and the
 * drive.file scope on the consent screen (a non-sensitive scope, so no review).
 */
const CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  '516652064312-ckf734fph9v7murufcjf58a17gkp76qq.apps.googleusercontent.com'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
interface GoogleOAuth2 {
  initTokenClient: (cfg: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
    error_callback?: (e: { type?: string; message?: string }) => void
  }) => TokenClient
}
declare global {
  interface Window { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }
}

let script: Promise<void> | null = null
let token: { value: string; until: number } | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  script ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      script = null
      reject(new Error('Google sign-in could not load. Check your connection, or an ad blocker.'))
    }
    document.head.appendChild(s)
  })
  return script
}

/** A Drive token, asking the student only the first time in this tab. */
async function getToken(): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value
  await loadGis()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google sign-in did not start.')
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) {
          reject(new Error(r.error === 'access_denied' ? 'Drive access was not given.' : 'Google did not give access to Drive.'))
          return
        }
        token = { value: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 }
        resolve(r.access_token)
      },
      error_callback: (e) =>
        reject(new Error(e.type === 'popup_closed' ? 'The Google window was closed before finishing.' : 'Google sign-in was blocked. Allow pop-ups for this site and try again.')),
    })
    client.requestAccessToken({ prompt: token ? '' : 'consent' })
  })
}

export interface DriveResult { url: string }

/** Upload a .docx and have Drive convert it into a Google Doc. */
export async function saveDocxToDrive(name: string, docx: Blob): Promise<DriveResult> {
  const access = await getToken()
  const meta = { name: name.slice(0, 200) || 'Note', mimeType: 'application/vnd.google-apps.document' }
  const body = new FormData()
  body.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
  body.append('file', docx)
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}` },
    body,
  })
  if (res.status === 401) {
    token = null
    throw new Error('Your Google session ended. Press Save to Google Drive again.')
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null
    const reason = j?.error?.errors?.[0]?.reason
    throw new Error(
      reason === 'accessNotConfigured'
        ? 'Saving to Drive is not switched on for ConcordiaTracker yet.'
        : reason === 'storageQuotaExceeded'
          ? 'Your Google Drive is full.'
          : 'Google Drive did not accept the file. Try again.',
    )
  }
  const j = (await res.json()) as { id: string; webViewLink?: string }
  return { url: j.webViewLink ?? `https://docs.google.com/document/d/${j.id}/edit` }
}
