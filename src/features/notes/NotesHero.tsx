import type { ReactNode } from 'react'
import { FileText, FolderClosed, ListChecks, Search, Users, X } from 'lucide-react'
import { PHOTOS } from '@/data/resource-photos'

/**
 * The banner on the Notes home, in the same family as Courses and the Planner:
 * a campus photo under a dark wash, what you have as chips, and the search over
 * every note as the one thing to reach for.
 */
export function NotesHero({
  notes,
  folders,
  tasks,
  shared,
  query,
  onQuery,
  actions,
}: {
  notes: number
  folders: number
  /** Open tasks kept as notes. */
  tasks: number
  /** Notes and folders other people shared with you. */
  shared: number
  query: string
  onQuery: (q: string) => void
  /** New folder, new note. They sit on the photo, so they bring their own colours. */
  actions: ReactNode
}) {
  return (
    <header className="ct-res-in relative isolate rounded-3xl bg-[#0b0d16] text-white">
      {/* Clipped by its own layer, not the banner: the New note menu opens out of it. */}
      <span aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <img src={PHOTOS.stacks.src} alt="" className="ct-res-kenburns absolute inset-0 size-full object-cover grayscale" />
        <span
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(100deg, rgba(8,10,20,0.95) 0%, rgba(8,10,20,0.85) 42%, rgba(8,10,20,0.45) 78%, rgba(8,10,20,0.3) 100%), linear-gradient(0deg, rgba(8,10,20,0.7), transparent 45%)',
          }}
        />
      </span>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">Your notebook</p>
          <h1 className="mt-2 font-display text-[40px] leading-[1] font-bold tracking-tight sm:text-[56px]">Notes</h1>
          <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
            <Chip icon={FileText} n={notes} label={notes === 1 ? 'note' : 'notes'} />
            <Chip icon={FolderClosed} n={folders} label={folders === 1 ? 'folder' : 'folders'} />
            {tasks > 0 && <Chip icon={ListChecks} n={tasks} label={tasks === 1 ? 'open task' : 'open tasks'} />}
            {shared > 0 && <Chip icon={Users} n={shared} label="shared with you" />}
          </ul>
          <label
            className="ct-ring relative mt-5 flex h-12 max-w-xl items-center gap-2.5 rounded-full bg-white/[0.14] px-4 backdrop-blur-md focus-within:bg-white/[0.2]"
            style={{ ['--ct-ring' as string]: '#ffffff' }}
          >
            <Search size={17} className="shrink-0 text-white/70" aria-hidden />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search all notes"
              aria-label="Search all notes"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/60"
            />
            {query && (
              <button type="button" aria-label="Clear search" onClick={() => onQuery('')} className="text-white/70 hover:text-white">
                <X size={16} aria-hidden />
              </button>
            )}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-fg">{actions}</div>
      </div>
    </header>
  )
}

function Chip({ icon: Icon, n, label }: { icon: typeof FileText; n: number; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
      <Icon size={13} className="text-white/70" aria-hidden />
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-white/75">{label}</span>
    </li>
  )
}
