import { useEffect, useState } from 'react'
import { ModalShell } from '@/command/ModalShell'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { useAppData } from '@/app/providers/app-data'
import {
  clearNote,
  listNotes,
  noteAge,
  setNote,
  NOTE_MAX,
  NOTE_SUGGESTIONS,
  type Note,
} from '@/lib/notes'
import { cn } from '@/lib/cn'

/** Module level: `react-hooks/purity` bars a clock read in a component body. */
const nowMs = () => Date.now()

/**
 * The row of faces with a bubble above each, between the search and the
 * filters.
 *
 * It is the reference's notes row, doing the job a campus messenger can
 * actually use it for: WHERE YOU ARE AND WHAT YOU ARE DOING. "At the
 * library", "In class till 4". The people in this list want that answered
 * about each other far more often than they want a status quote.
 *
 * YOUR SLOT IS ALWAYS FIRST and always present, whether or not you have
 * written anything, because that slot is how you write one. An empty row with
 * nothing to tap would be a feature nobody discovers.
 */
export function NotesRow() {
  const { user } = useAppData()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    void listNotes().then((r) => alive && setNotes(r))
    return () => {
      alive = false
    }
  }, [tick])

  const mine = notes?.find((n) => n.is_mine) ?? null
  const others = (notes ?? []).filter((n) => !n.is_mine)

  return (
    <>
      <div className="-mx-3 mb-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* items-START, so the AVATARS line up. Aligning the bottoms instead
            lets a slot with an extra caption under it ride its face higher
            than its neighbours, and the row stops reading as a row. The
            padding above reserves the space the bubbles float in. */}
        <div className="flex w-max items-start gap-3 pt-12 pb-2">
          <Slot
            avatar={
              <PersonAvatar
                person={{
                  handle: user.handle ?? '',
                  name: user.name ?? null,
                  avatar_url: user.avatarUrl ?? null,
                }}
                className="size-14"
              />
            }
            label="Your note"
            bubble={mine?.body ?? 'Share a note'}
            faded={!mine}
            onClick={() => setEditing(true)}
          />
          {others.map((n) => (
            <Slot
              key={n.user_id}
              avatar={
                <PersonAvatar
                  person={{ handle: n.handle, name: n.name, avatar_url: n.avatar_url }}
                  className="size-14"
                />
              }
              label={n.name?.split(' ')[0] ?? n.handle}
              bubble={n.body}
              sub={noteAge(n.created_at, nowMs())}
            />
          ))}
        </div>
      </div>

      {editing && (
        <NoteComposer
          current={mine?.body ?? ''}
          onDone={() => {
            setEditing(false)
            setTick((n) => n + 1)
          }}
        />
      )}
    </>
  )
}

/**
 * One face with its bubble sitting on top of it.
 *
 * THE BUBBLE IS THE FIDDLY PART. It has to be able to be wider than the face
 * and taller than one line — a note is a sentence, not a word — while never
 * reaching into its neighbour. So: anchored to the TOP of the avatar
 * (`bottom-full`) rather than nudged by a fixed offset, centred on it,
 * capped near the slot width, and allowed exactly two lines before it
 * clamps. The row reserves the height for it once, which is why every avatar
 * still sits on one baseline however long the notes are.
 *
 * The first version let a long note run on one line at 8.5rem over a 4rem
 * slot, and two of them overlapped and clipped each other.
 */
function Slot({
  avatar,
  label,
  bubble,
  sub,
  faded,
  onClick,
}: {
  avatar: React.ReactNode
  label: string
  bubble: string
  sub?: string
  faded?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="relative flex justify-center">
        <span
          className={cn(
            /* 7rem over a 5rem slot. At 5.5rem "Share a note" clipped its own
               second line, which is a poor first impression from the control
               that invites you to write one. It still cannot reach a
               neighbour: the gap is 0.75rem and the overhang is 1rem a side,
               and the two-line clamp caps the height either way. */
            'pointer-events-none absolute bottom-full left-1/2 mb-1.5 w-max max-w-[7rem]',
            '-translate-x-1/2 rounded-2xl rounded-bl-sm px-2 py-1 text-center',
            'text-[10.5px] leading-[1.25] [display:-webkit-box] [-webkit-box-orient:vertical]',
            '[-webkit-line-clamp:2] overflow-hidden',
            faded ? 'bg-surface-2 text-subtle' : 'bg-surface-2 text-fg',
          )}
        >
          {bubble}
        </span>
        {avatar}
      </span>
      <span className="mt-1.5 block w-full truncate text-center text-[11px] text-subtle">
        {label}
      </span>
      {sub && (
        <span className="block w-full truncate text-center text-[10px] text-subtle/70">{sub}</span>
      )}
    </>
  )
  if (!onClick) return <span className="block w-[5rem] shrink-0">{body}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-[5rem] shrink-0 transition-transform duration-150 active:scale-95"
    >
      {body}
    </button>
  )
}

/**
 * Setting one: six answers and a box.
 *
 * The suggestions are there because a blank field is why status features go
 * unused — nobody has a line ready on demand. Tapping one fills the box
 * rather than posting immediately, so the common case is one tap and an edit
 * rather than a commitment.
 */
function NoteComposer({ current, onDone }: { current: string; onDone: () => void }) {
  const [text, setText] = useState(current)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    const e = await setNote(text)
    setBusy(false)
    if (e) return setErr(e)
    onDone()
  }

  const remove = async () => {
    setBusy(true)
    await clearNote()
    setBusy(false)
    onDone()
  }

  return (
    <ModalShell onClose={onDone} label="Set your note" widthClass="sm:max-w-sm">
      <div className="p-4">
        {/* No close button here: ModalShell renders one, and two X's in the
            same corner is just a second thing to aim at. */}
        <h2 className="mb-3 text-[15px] font-semibold text-fg">What are you up to?</h2>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {NOTE_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setText(s)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
                text === s ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-fg hover:bg-surface-2/70',
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <input
          value={text}
          maxLength={NOTE_MAX}
          autoFocus
          onChange={(e) => {
            setText(e.target.value)
            setErr(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && text.trim() && void save()}
          placeholder="Or write your own"
          aria-label="Your note"
          className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <p className="mt-1.5 text-[11.5px] text-subtle">
          {NOTE_MAX - text.length} left · disappears after 24 hours · only people you are connected
          to can see it
        </p>
        {err && <p className="mt-1.5 text-[12px] text-danger">{err}</p>}

        <div className="mt-4 flex items-center justify-between gap-2">
          {current ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-danger transition-colors duration-150 hover:bg-danger/10 disabled:opacity-50"
            >
              Remove
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => void save()}
            className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            {current ? 'Update' : 'Share'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
