import { useEffect, useRef, useState } from 'react'
import { Download, Presentation, Trash2, Upload } from 'lucide-react'
import { reportWriteError } from '@/lib/write-errors'
import { cn } from '@/lib/cn'
import type { NoteProvider } from './collab/NoteProvider'
import { noteFileUrl, uploadNoteFile } from './media/note-files'

interface Slide { path: string; name: string; mime: string }

function readSlides(v: unknown): Slide[] {
  return Array.isArray(v)
    ? v.filter((s): s is Slide => !!s && typeof s.path === 'string' && typeof s.name === 'string').slice(0, 12)
    : []
}

/**
 * Lecture slides, open beside the note: the PDF a professor posted, kept with
 * this note so you can write next to it. The list lives in the note's live
 * document (its 'meta' map), so everyone in the note sees the same slides.
 * PowerPoint files cannot be shown in a browser; they are kept and offered as
 * a download, with a hint to save them as PDF first.
 */
export function SlidesPanel({ provider, noteId, canEdit }: { provider: NoteProvider; noteId: string; canEdit: boolean }) {
  const [slides, setSlides] = useState<Slide[]>([])
  const [pick, setPick] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const meta = provider.doc.getMap('meta')
    const read = () => setSlides(readSlides(meta.get('slides')))
    read()
    meta.observe(read)
    return () => meta.unobserve(read)
  }, [provider])

  const current = slides[Math.min(pick, slides.length - 1)]
  useEffect(() => {
    let alive = true
    if (!current || current.mime !== 'application/pdf') return
    void noteFileUrl(current.path).then((u) => alive && setUrl(u))
    return () => { alive = false }
  }, [current])

  const add = async (file: File) => {
    setBusy(true)
    try {
      const { path, mime } = await uploadNoteFile(noteId, file)
      provider.doc.getMap('meta').set('slides', [...slides, { path, name: file.name.slice(0, 120), mime }])
      setPick(slides.length)
    } catch (e) {
      reportWriteError('The slides were not added', e instanceof Error ? e.message : 'Try again.')
    } finally {
      setBusy(false)
    }
  }
  const remove = (i: number) => {
    provider.doc.getMap('meta').set('slides', slides.filter((_, k) => k !== i))
    setPick(0)
  }
  const download = async (s: Slide) => {
    const u = await noteFileUrl(s.path, s.name)
    if (u) window.location.assign(u)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-1 border-b border-border p-3">
        {slides.map((s, i) => (
          <div key={s.path} className={cn('group flex items-center gap-2 rounded-lg px-2 py-1.5', i === pick ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
            <button type="button" onClick={() => setPick(i)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <Presentation size={15} className="shrink-0 text-muted" aria-hidden />
              <span className="truncate text-[13px] text-fg">{s.name}</span>
            </button>
            <button type="button" aria-label="Download" onClick={() => void download(s)} className="grid size-6 place-items-center rounded text-subtle hover:text-fg"><Download size={13} aria-hidden /></button>
            {canEdit && <button type="button" aria-label="Remove slides" onClick={() => remove(i)} className="grid size-6 place-items-center rounded text-subtle hover:text-danger"><Trash2 size={13} aria-hidden /></button>}
          </div>
        ))}
        {canEdit && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-[13px] font-medium text-accent hover:bg-surface-2 disabled:opacity-50">
            <Upload size={14} aria-hidden />{busy ? 'Uploading…' : 'Add slides (PDF)'}
          </button>
        )}
        <input ref={input} type="file" hidden accept="application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void add(f); e.target.value = '' }} />
      </div>
      <div className="min-h-0 flex-1 bg-surface-2/40">
        {!current ? (
          <p className="p-4 text-[13px] text-subtle">{canEdit ? 'Add the lecture slides to read them beside your notes.' : 'No slides with this note.'}</p>
        ) : current.mime === 'application/pdf' ? (
          url ? <iframe title={current.name} src={url} className="h-full w-full border-0" /> : <div className="ct-shimmer m-3 h-64 rounded-lg" />
        ) : (
          <p className="p-4 text-[13px] text-muted">PowerPoint files cannot be shown in the browser. Download it, or save it as PDF and add that instead.</p>
        )}
      </div>
    </div>
  )
}
