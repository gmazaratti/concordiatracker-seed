import type { JSONContent } from '@tiptap/react'
import { VersionHistory } from './VersionHistory'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import { ShareDialog } from './ShareDialog'
import { PageSetupDialog } from './PageSetupDialog'
import { PdfExport } from './PdfExport'
import type { PageSetup } from './page-setup'

export type DialogState = null | 'history' | 'share' | 'page' | { template: JSONContent } | { pdf: JSONContent }

/** Every dialog the note page can open, in one place. */
export function NoteDialogs({ state, onClose, noteId, title, page, canEdit, onPage, onRestore, onTemplate, onShared }: {
  state: DialogState
  onClose: () => void
  noteId: string
  title: string
  page: PageSetup
  canEdit: boolean
  onPage: (p: PageSetup) => void
  onRestore: (content: JSONContent) => void
  onTemplate: (name: string, content: JSONContent) => Promise<unknown>
  onShared: () => void
}) {
  if (!state) return null
  if (state === 'history') {
    return (
      <VersionHistory noteId={noteId} onClose={onClose} onRestore={(v) => {
        // A restore is an ordinary edit in the live document, so everyone sees
        // it at once and it can itself be undone from history.
        if (canEdit) onRestore(v.content)
        onClose()
      }} />
    )
  }
  if (state === 'share') return <ShareDialog kind="note" id={noteId} name={title || 'Untitled note'} onClose={() => { onShared(); onClose() }} />
  if (state === 'page') return <PageSetupDialog value={page} onClose={onClose} onSave={(p) => { onPage(p); onClose() }} />
  if ('template' in state) {
    return <SaveTemplateDialog onClose={onClose} onSave={async (name) => { await onTemplate(name, state.template); onClose() }} />
  }
  return <PdfExport title={title} content={state.pdf} setup={page} onDone={onClose} />
}
