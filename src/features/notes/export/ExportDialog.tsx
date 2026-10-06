import { useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { Check, Copy, ExternalLink, FileDown, HardDriveUpload, Loader2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { noteToHtml } from './to-html'
import { Switch } from '@/features/settings/controls'
import type { PageSetup } from '../page-setup'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/**
 * Export to Word and to Google Docs. No extension needed:
 *
 *   Word        a real .docx, built in the browser (it also opens in Pages,
 *               LibreOffice, and in Google Docs when uploaded to Drive).
 *   Drive       save it to Google Drive as a Google Doc, straight from the
 *               browser with the drive.file scope (only files this app makes).
 *   Google Docs or copy the note with its formatting and pictures, open a new
 *               Google Doc, paste: no Google sign-in at all.
 */
export function ExportDialog({ title, content, setup, onClose }: { title: string; content: JSONContent; setup: PageSetup; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [titleAtTop, setTitleAtTop] = useState(true)
  const [drive, setDrive] = useState<{ busy: boolean; url: string | null }>({ busy: false, url: null })

  const toDrive = async () => {
    setDrive({ busy: true, url: null })
    setError('')
    try {
      const [{ noteToDocx }, { saveDocxToDrive }] = await Promise.all([import('./to-docx'), import('./drive')])
      const blob = await noteToDocx(title, content, setup, titleAtTop)
      const r = await saveDocxToDrive(title || 'Note', blob)
      setDrive({ busy: false, url: r.url })
    } catch (e) {
      setDrive({ busy: false, url: null })
      setError(e instanceof Error ? e.message : 'The note could not be saved to Drive.')
    }
  }

  useEffect(() => {
    let alive = true
    void noteToHtml(title, content, titleAtTop).then((h) => { if (alive) { setHtml(h); setCopied(false) } })
    return () => { alive = false }
  }, [title, content, titleAtTop])

  const word = async () => {
    setBusy(true)
    setError('')
    try {
      const { noteToDocx } = await import('./to-docx')
      const blob = await noteToDocx(title, content, setup, titleAtTop)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${(title || 'Note').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Note'}.docx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch {
      setError('The Word file could not be made. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!html) return
    try {
      const text = new DOMParser().parseFromString(html, 'text/html').body.innerText
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })])
      setCopied(true)
    } catch {
      setError('Your browser blocked copying. Select the text in the note and copy it instead.')
    }
  }

  return (
    <ModalShell label="Export" onClose={onClose} widthClass="sm:max-w-md">
      <div className="flex flex-col gap-5 p-5">
        <h2 className="text-[16px] font-semibold text-fg">Export</h2>
        <label className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/60 px-3 py-2 text-[13px] text-fg">
          Put the title at the top
          <Switch label="Put the title at the top" checked={titleAtTop} onChange={setTitleAtTop} />
        </label>

        <section className="flex flex-col gap-2">
          <p className="text-[13.5px] font-semibold text-fg">Microsoft Word (.docx)</p>
          <p className="text-[12.5px] text-muted">Keeps headings, lists, colours, links, pictures, and your header and footer with page numbers. Also opens in Pages and LibreOffice.</p>
          <Button onClick={() => void word()} disabled={busy} className="self-start">
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <FileDown size={15} aria-hidden />}
            Download .docx
          </Button>
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-[13.5px] font-semibold text-fg">Google Docs</p>
          <p className="text-[12.5px] text-muted">Save it straight to your Drive as a Google Doc. ConcordiaTracker can only see files it saves there, never the rest of your Drive.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void toDrive()} disabled={drive.busy}>
              {drive.busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <HardDriveUpload size={14} aria-hidden />}
              {drive.busy ? 'Saving…' : 'Save to Google Drive'}
            </Button>
            {drive.url && (
              <a href={drive.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-[13px] font-medium text-accent hover:underline">
                <ExternalLink size={14} aria-hidden /> Open it in Google Docs
              </a>
            )}
          </div>
          <p className="pt-1 text-[12px] text-subtle">Or, without signing in to Google:</p>
          <ol className="flex flex-col gap-2 text-[12.5px] text-muted">
            <li className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg">1</span>
              <Button variant="outline" size="sm" onClick={() => void copy()} disabled={!html}>
                {copied ? <Check size={14} aria-hidden /> : html ? <Copy size={14} aria-hidden /> : <Loader2 size={14} className="animate-spin" aria-hidden />}
                {copied ? 'Copied' : 'Copy the note'}
              </Button>
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg">2</span>
              <a href="https://docs.new" target="_blank" rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] font-medium text-fg hover:bg-surface-2">
                <ExternalLink size={14} aria-hidden /> Open a new Google Doc
              </a>
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg">3</span>
              Paste with {MAC ? '⌘V' : 'Ctrl+V'}. Formatting and pictures come with it.
            </li>
          </ol>
        </section>
        {error && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
      </div>
    </ModalShell>
  )
}
