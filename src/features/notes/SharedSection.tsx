import { useNavigate } from 'react-router-dom'
import { FileText, Folder } from 'lucide-react'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import type { SharedItem } from './sharing-api'

/** Folders and notes other people shared with me, with who shared them. */
export function SharedSection({ items }: { items: SharedItem[] }) {
  const navigate = useNavigate()
  if (items.length === 0) return null
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[12px] font-semibold tracking-wide text-subtle uppercase">Shared with me</h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {items.map((it) => {
          const Icon = it.kind === 'folder' ? Folder : FileText
          return (
            <li key={`${it.kind}-${it.id}`}>
              <button
                type="button"
                onClick={() => navigate(it.kind === 'folder' ? `/app/notes/f/${it.id}` : `/app/notes/n/${it.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                  <Icon size={19} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-fg">{it.name}</span>
                  <span className="flex items-center gap-1.5 text-[12px] text-subtle">
                    <PersonAvatar person={{ handle: it.ownerHandle ?? '', name: it.ownerName, avatar_url: it.ownerAvatar }} className="size-4" />
                    <span className="truncate">{it.ownerName || `@${it.ownerHandle}`}</span>
                    <span aria-hidden>·</span>
                    <span>{it.role === 'editor' ? 'Can edit' : 'Can view'}</span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
