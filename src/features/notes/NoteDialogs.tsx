import type { JSONContent } from '@tiptap/react'
import { VersionHistory } from './VersionHistory'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import { ShareDialog } from './ShareDialog'
import { PageSetupDialog } from './PageSetupDialog'
import { PdfExport } from './PdfExport'
import { ExportDialog } from './export/ExportDialog'
import { StudyDialog } from './study/StudyDialog'
import { VoiceRecorder } from './media/VoiceRecorder'
import type { PageSetup } from './page-setup'
import type { NoteVersion } from './types'

export type DialogState =
  | null
  | 'share'
  | 'page'
  | 'voice'
  | { history: JSONContent }
  | { template: JSONContent }
  | { pdf: JSONContent }
  | { export: JSONContent }
  | { study: JSONContent }

/** Every dialog the note page can open, in one place. */
export function NoteDialogs({ state, onClose, noteId, title, page, canEdit, editor, onPage, onRestore, onTemplate, onShared, onVoice }: {
  state: DialogState
  onClose: () => void
  noteId: string
  title: string
  page: PageSetup
  canEdit: boolean
  /** Who last saved the note, for the top of version history. */
  editor: NoteVersion['editor']
  onPage: (p: PageSetup) => void
  onRestore: (content: JSONContent) => void
  onTemplate: (name: string, content: JSONContent) => Promise<unknown>
  onShared: () => void
  onVoice: (blob: Blob, durationMs: number) => void
}) {
  if (!state) return null
  if (state === 'share') return <ShareDialog kind="note" id={noteId} name={title || 'Untitled note'} onClose={() => { onShared(); onClose() }} />
  if (state === 'page') return <PageSetupDialog value={page} onClose={onClose} onSave={(p) => { onPage(p); onClose() }} />
  if (state === 'voice') return <VoiceRecorder onClose={onClose} onAdd={(b, ms) => { onVoice(b, ms); onClose() }} />
  if ('history' in state) {
    return (
      <VersionHistory noteId={noteId} current={{ title, content: state.history, editor }} onClose={onClose} onRestore={(v) => {
        // A restore is an ordinary edit in the live document, so everyone sees
        // it at once and it can itself be undone from history.
        if (canEdit) onRestore(v.content)
        onClose()
      }} />
    )
  }
  if ('template' in state) {
    return <SaveTemplateDialog onClose={onClose} onSave={async (name) => { await onTemplate(name, state.template); onClose() }} />
  }
  if ('export' in state) return <ExportDialog title={title} content={state.export} setup={page} onClose={onClose} />
  if ('study' in state) return <StudyDialog title={title} content={state.study} onClose={onClose} />
  return <PdfExport title={title} content={state.pdf} setup={page} onDone={onClose} />
}
