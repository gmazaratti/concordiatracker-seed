import { useEffect, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Link2Off, Monitor } from 'lucide-react'
import { FolderBrowser } from './FolderBrowser'
import { SharedFolderView } from './SharedFolderView'
import { NotePage } from './NotePage'
import { useNotesData } from './useNotesData'
import { claimLink } from './sharing-api'
import { ensureClassFolders } from './notes-api'

/**
 * /app/notes                 the home grid (classes and folders, one kind)
 * /app/notes/f/:id           inside a folder ('general' = notes in no folder)
 * /app/notes/c/:courseId     a class's notebook, resolved to its folder
 * /app/notes/n/:id           a note
 * /app/notes/s/:token        a share link: joins, then opens what it points at
 */
export function NotesRoutes() {
  return (
    <>
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center md:hidden">
        <Monitor size={28} className="text-subtle" aria-hidden />
        <p className="text-[15px] font-semibold text-fg">Notes is on desktop for now</p>
        <p className="max-w-xs text-[13.5px] text-muted">Open ConcordiaTracker on a laptop or a wider window to write notes. Phone support is coming.</p>
      </div>
      <div className="hidden h-full min-h-0 md:block">
        <Routes>
          <Route index element={<Home />} />
          <Route path="f/:id" element={<FolderRoute />} />
          <Route path="c/:courseId" element={<ClassRoute />} />
          <Route path="n/:id" element={<NoteRoute />} />
          <Route path="s/:token" element={<LinkRoute />} />
          <Route path="*" element={<Navigate to="/app/notes" replace />} />
        </Routes>
      </div>
    </>
  )
}

/** Old links (?note=…, ?c=…) from before the redesign still land somewhere. */
function Home() {
  const [params] = useSearchParams()
  if (params.get('note')) return <Navigate to={`/app/notes/n/${params.get('note')}`} replace />
  if (params.get('c')) return <Navigate to={`/app/notes/c/${params.get('c')}`} replace />
  return <FolderBrowser folderId={null} />
}

function FolderRoute() {
  const { id = '' } = useParams()
  const data = useNotesData()
  if (id === 'general') return <FolderBrowser key="general" folderId="general" />
  if (id === 'tasks') return <FolderBrowser key="tasks" folderId="tasks" />
  if (data.loading) return <div className="mx-auto mt-16 h-40 w-full max-w-6xl px-10"><div className="ct-shimmer h-full rounded-2xl" /></div>
  return data.folders.some((f) => f.id === id) ? <FolderBrowser key={id} folderId={id} /> : <SharedFolderView key={id} folderId={id} />
}

function ClassRoute() {
  const { courseId = '' } = useParams()
  const data = useNotesData()
  const navigate = useNavigate()
  const folder = data.folders.find((f) => f.courseId === courseId)
  useEffect(() => {
    if (folder) navigate(`/app/notes/f/${folder.id}`, { replace: true })
    else if (!data.loading) void ensureClassFolders().then(data.refresh)
  }, [folder, data.loading, data.refresh, navigate])
  return <div className="mx-auto mt-16 h-40 w-full max-w-6xl px-10"><div className="ct-shimmer h-full rounded-2xl" /></div>
}

function NoteRoute() {
  const { id = '' } = useParams()
  return <NotePage key={id} noteId={id} />
}

function LinkRoute() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void claimLink(token).then((r) => {
      if (cancelled) return
      if ('error' in r) setError(r.error)
      else navigate(r.kind === 'note' ? `/app/notes/n/${r.target}` : `/app/notes/f/${r.target}`, { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [token, navigate])
  if (!error) return <div className="mx-auto mt-24 h-40 w-full max-w-md ct-shimmer rounded-2xl" />
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
      <Link2Off size={26} className="text-subtle" aria-hidden />
      <p className="text-[15px] font-semibold text-fg">This link does not work</p>
      <p className="text-[13.5px] text-muted">{error}</p>
      <Link to="/app/notes" className="mt-2 text-[13.5px] font-medium text-accent hover:underline">Go to Notes</Link>
    </div>
  )
}
