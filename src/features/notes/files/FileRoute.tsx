import { useNavigate, useParams } from 'react-router-dom'
import { FileX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useNoteFiles } from './useNoteFiles'
import { FileViewer } from './FileViewer'
import { isFileKey } from './file-links'

/** /app/notes/file/:key: a file link opened on its own, full screen. */
export function FileRoute() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const store = useNoteFiles()
  const file = isFileKey(key) ? store.files.find((f) => f.key === key) : undefined
  const close = () => (window.history.length > 1 ? navigate(-1) : navigate('/app/notes'))

  if (file) return <FileViewer file={file} onClose={close} />
  if (!store.loaded) return <div className="mx-auto mt-16 h-60 w-full max-w-3xl px-10"><div className="ct-shimmer h-full rounded-2xl" /></div>
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
      <FileX size={28} className="text-subtle" aria-hidden />
      <p className="text-[15px] font-semibold text-fg">This file can't be opened</p>
      <p className="max-w-sm text-[13.5px] text-muted">It was deleted, or it is in a folder that was not shared with you.</p>
      <Button variant="outline" size="sm" onClick={() => navigate('/app/notes')}>Go to Notes</Button>
    </div>
  )
}
