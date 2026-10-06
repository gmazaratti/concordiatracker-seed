import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { noteExtensions } from './editor-extensions'
import { pageTheme, type PageSetup } from './page-setup'
import { printBandsCss } from './print-bands'

/**
 * Export to PDF: a print-only copy of the note — the same schema, so headings,
 * colours, highlights, checklists and images come out as they look — handed
 * to the browser's print dialog with "Save as PDF". The file is named after
 * the note (the dialog takes the page title).
 *
 * Printing waits for every image in the copy to finish loading; a PDF with
 * grey boxes where the pictures should be is the usual way this goes wrong.
 */
export function PdfExport({ title, content, setup, onDone }: { title: string; content: JSONContent; setup: PageSetup; onDone: () => void }) {
  const editor = useEditor({ editable: false, extensions: noteExtensions(), content, editorProps: { attributes: { class: 'ct-note-doc' } } })

  useEffect(() => {
    if (!editor) return
    let cancelled = false
    const previousTitle = document.title
    const finish = () => {
      document.body.classList.remove('ct-printing')
      document.title = previousTitle
      window.removeEventListener('afterprint', finish)
      onDone()
    }
    void (async () => {
      // Let the image views ask for their links, then wait for every picture.
      await new Promise((r) => setTimeout(r, 400))
      const imgs = [...document.querySelectorAll<HTMLImageElement>('.ct-pdf-root img')]
      await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r }))))
      await new Promise((r) => setTimeout(r, 150))
      if (cancelled) return
      document.title = title || 'Note'
      document.body.classList.add('ct-printing')
      window.addEventListener('afterprint', finish)
      window.print()
      // Some browsers never fire afterprint; the dialog has closed by now.
      setTimeout(() => { if (document.body.classList.contains('ct-printing')) finish() }, 1000)
    })()
    return () => {
      cancelled = true
      document.body.classList.remove('ct-printing')
    }
  }, [editor, title, onDone])

  const custom = setup.color !== 'theme'
  const date = new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
  return createPortal(
    <div className="ct-print-root ct-pdf-root" data-theme={pageTheme(setup.color) ?? 'light'} aria-hidden
      style={{ position: 'fixed', left: -10000, top: 0, width: 816, background: custom ? setup.color : '#ffffff' }}>
      {/* The header and footer of every printed page (Chrome and Edge). */}
      <style>{printBandsCss(setup, title, date)}</style>
      <div className="text-fg">
        <EditorContent editor={editor} />
      </div>
    </div>,
    document.body,
  )
}
