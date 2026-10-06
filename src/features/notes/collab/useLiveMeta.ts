import { useEffect, useState } from 'react'
import type { NoteProvider } from './NoteProvider'
import { readPage, type PageSetup } from '../page-setup'

/**
 * The title and page setup, shared live through the note's Yjs document (a
 * small 'meta' map beside the text), so a rename or a page colour change
 * appears on everyone's screen at once. The columns on the notes row are
 * still written — lists, search and the PDF read those.
 */
export function useLiveMeta(provider: NoteProvider | null, initial: { title: string; page: PageSetup }) {
  const [title, setTitle] = useState(initial.title)
  const [page, setPage] = useState(initial.page)

  useEffect(() => {
    if (!provider) return
    const meta = provider.doc.getMap('meta')
    const read = () => {
      const t = meta.get('title')
      if (typeof t === 'string') setTitle(t)
      const p = meta.get('page')
      if (p) setPage(readPage(p))
    }
    read()
    meta.observe(read)
    return () => meta.unobserve(read)
  }, [provider])

  const writeTitle = (v: string) => {
    setTitle(v)
    provider?.doc.getMap('meta').set('title', v)
  }
  const writePage = (v: PageSetup) => {
    setPage(v)
    provider?.doc.getMap('meta').set('page', v)
  }
  return { title, page, writeTitle, writePage }
}
