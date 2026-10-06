import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { RotateCcw } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { cn } from '@/lib/cn'
import { listVersions } from './notes-api'
import type { NoteVersion } from './types'
import { noteExtensions } from './editor-extensions'
import { diffSummary, diffText, docText, type Seg } from './text-diff'

const EXTENSIONS = noteExtensions()

type Entry = NoteVersion & { current?: boolean }

/**
 * Earlier states of a note, newest first, written by the database (one per ten
 * minutes of editing, last 50 kept), each with WHO wrote it and WHAT they
 * changed — the words added in green and removed struck through, against the
 * version before. Restoring is just another edit, so the state being replaced
 * becomes a version itself and the restore can be undone from this same list.
 */
export function VersionHistory({ noteId, current, onRestore, onClose }: {
  noteId: string
  current: { title: string; content: JSONContent; editor: NoteVersion['editor'] }
  onRestore: (v: NoteVersion) => void
  onClose: () => void
}) {
  const [versions, setVersions] = useState<NoteVersion[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string>('current')
  const [view, setView] = useState<'changes' | 'page'>('changes')

  useEffect(() => {
    listVersions(noteId).then(setVersions).catch(() => setFailed(true))
  }, [noteId])

  const entries: Entry[] = useMemo(() => [
    { id: 'current', title: current.title, content: current.content, createdAt: '', editor: current.editor, current: true },
    ...(versions ?? []),
  ], [versions, current])
  const texts = useMemo(() => entries.map((e) => docText(e.content)), [entries])
  const idx = Math.max(0, entries.findIndex((e) => e.id === picked))
  const entry = entries[idx]
  // What this version's author changed: from the version before it to this one.
  const segs: Seg[] | null = useMemo(() => (idx + 1 < entries.length ? diffText(texts[idx + 1], texts[idx]) : null), [idx, entries.length, texts])
  const sums = useMemo(() => entries.map((_, i) => (i + 1 < entries.length ? diffSummary(diffText(texts[i + 1], texts[i])) : null)), [entries, texts])

  return (
    <ModalShell label="Version history" onClose={onClose} widthClass="sm:max-w-4xl" scroll={false}>
      <div className="flex max-h-[82vh] min-h-[24rem] flex-col sm:flex-row">
        <div className="shrink-0 border-b border-border p-3 sm:w-64 sm:overflow-y-auto sm:border-r sm:border-b-0">
          <h2 className="px-1 pb-2 text-[15px] font-semibold text-fg">Version history</h2>
          {failed && <p className="px-1 text-[13px] text-danger">History could not be loaded.</p>}
          <ul className="flex gap-1 overflow-x-auto sm:flex-col">
            {entries.map((v, i) => (
              <li key={v.id}>
                <button type="button" onClick={() => setPicked(v.id)}
                  className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left whitespace-nowrap', v.id === entry.id ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
                  <PersonAvatar person={{ name: v.editor?.name ?? 'Someone', handle: v.editor?.handle ?? '', avatar_url: v.editor?.avatar ?? null }} className="mt-0.5 size-7 shrink-0" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium text-fg">
                      {v.current ? 'Current version' : new Date(v.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className="truncate text-[12px] text-muted">{v.editor?.name || (v.editor?.handle ? `@${v.editor.handle}` : 'Someone')}</span>
                    {sums[i] && (sums[i]!.added > 0 || sums[i]!.removed > 0) && (
                      <span className="text-[11.5px] tabular-nums">
                        <span className="text-success">+{sums[i]!.added}</span> <span className="text-danger">−{sums[i]!.removed}</span>
                        <span className="text-subtle"> words</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {versions?.length === 0 && <p className="mt-2 px-1 text-[12.5px] text-subtle">Earlier versions appear here, one for every ten minutes of editing.</p>}
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-border px-4 py-2" role="tablist" aria-label="Show">
            {(['changes', 'page'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={cn('rounded-md px-2.5 py-1 text-[12.5px] font-medium', view === v ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}>
                {v === 'changes' ? 'What changed' : 'Full page'}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {versions === null && !failed ? (
              <div className="ct-shimmer h-40 rounded-lg" />
            ) : view === 'changes' ? (
              segs ? <Changes segs={segs} who={entry.editor?.name ?? 'Someone'} /> : <p className="text-[13px] text-subtle">This is the oldest version kept, so there is nothing earlier to compare it with.</p>
            ) : (
              <>
                <p className="mb-3 text-[18px] font-semibold text-fg">{entry.title || 'Untitled note'}</p>
                <Preview key={entry.id} content={entry.content} />
              </>
            )}
          </div>
          {!entry.current && (
            <div className="flex justify-end border-t border-border p-3">
              <Button onClick={() => onRestore(entry)}>
                <RotateCcw size={15} aria-hidden />
                Restore this version
              </Button>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

function Changes({ segs, who }: { segs: Seg[]; who: string }) {
  if (!segs.some((s) => s.type !== 'same')) return <p className="text-[13px] text-subtle">No text changed in this version (formatting or layout only).</p>
  return (
    <div>
      <p className="mb-3 text-[12.5px] text-muted">Changes by <span className="font-medium text-fg">{who}</span>: <span className="text-success">added</span> and <span className="text-danger line-through">removed</span>.</p>
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words text-fg">
        {segs.map((s, i) => (
          <span key={i} className={cn(s.type === 'add' && 'rounded-sm bg-success/15 text-success', s.type === 'del' && 'rounded-sm bg-danger/10 text-danger line-through', s.type === 'same' && 'text-muted')}>{s.text}</span>
        ))}
      </p>
    </div>
  )
}

/** A read-only editor, not raw HTML: the stored document goes back through the
 *  same schema the editor uses, so nothing in it can render as markup. */
function Preview({ content }: { content: JSONContent }) {
  const editor = useEditor({ editable: false, extensions: EXTENSIONS, content, editorProps: { attributes: { class: 'ct-note-doc' } } })
  return <EditorContent editor={editor} />
}
