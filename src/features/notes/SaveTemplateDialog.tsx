import { useState } from 'react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'

/** Name the current note's layout as a template you can start new notes from. */
export function SaveTemplateDialog({ onSave, onClose }: { onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    await onSave(name.trim())
    setBusy(false)
  }
  return (
    <ModalShell label="Save as template" onClose={onClose}>
      <form
        className="flex flex-col gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <h2 className="text-[16px] font-semibold text-fg">Save as template</h2>
        <p className="text-[13px] text-muted">
          New notes made from it start with this note’s headings and text. Your notes stay as they are.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Case study"
          aria-label="Template name"
          className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-[14px] text-fg outline-none focus:border-accent"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || busy}>
            Save template
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
