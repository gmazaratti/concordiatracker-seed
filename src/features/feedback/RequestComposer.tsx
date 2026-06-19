import { useRef, useState } from 'react'
import { ArrowUp, Bold, Italic, Plus, SmilePlus, Strikethrough } from 'lucide-react'
import { EMOJI_PALETTE, guardContent, submitFeatureRequest } from './feedback-data'
import { Avatar } from './feedback-ui'

/** The expand-on-click composer — calm bar → focused editor with a rich toolbar
 * and a dimmed/blurred backdrop, in our tokens. Posts a feature request. */
export function RequestComposer({
  myName,
  myAvatar,
  onSubmitted,
}: {
  myName: string
  myAvatar?: string
  onSubmitted: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const collapse = () => {
    setExpanded(false)
    setEmojiOpen(false)
  }

  const wrap = (marker: string) => {
    const el = bodyRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const sel = body.slice(start, end) || 'text'
    setBody(body.slice(0, start) + marker + sel + marker + body.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + marker.length, start + marker.length + sel.length)
    })
  }

  const insertEmoji = (e: string) => {
    const el = bodyRef.current
    const pos = el?.selectionStart ?? body.length
    setBody(body.slice(0, pos) + e + body.slice(pos))
    setEmojiOpen(false)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(pos + e.length, pos + e.length)
    })
  }

  const submit = async () => {
    const guard = guardContent(title, body)
    if (guard) {
      setErr(guard)
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await submitFeatureRequest(title, body)
      setTitle('')
      setBody('')
      collapse()
      onSubmitted()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not post your request.')
    } finally {
      setBusy(false)
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition-colors duration-150 hover:border-border-strong"
      >
        <Avatar name={myName} avatarUrl={myAvatar} />
        <span className="text-[14px] text-subtle">{title.trim() || 'Suggest a feature…'}</span>
      </button>
    )
  }

  return (
    <>
      <button
        className="fixed inset-0 z-30 cursor-default bg-canvas/60 backdrop-blur-sm"
        onClick={collapse}
        aria-label="Close composer"
        tabIndex={-1}
      />
      <div
        className="relative z-40 rounded-2xl border border-accent/50 bg-surface p-4 shadow-2xl ring-2 ring-accent/30"
        onKeyDown={(e) => {
          if (e.key === 'Escape') collapse()
        }}
      >
        <div className="flex items-start gap-3">
          <Avatar name={myName} avatarUrl={myAvatar} />
          <div className="min-w-0 flex-1">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title — what do you want?"
              maxLength={120}
              className="w-full bg-transparent text-[15px] font-semibold text-fg placeholder:text-subtle focus:outline-none"
            />
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Add detail… you can use **bold**, *italic*, ~~strike~~"
              className="mt-2 w-full resize-y bg-transparent text-[14px] leading-relaxed text-fg placeholder:text-subtle focus:outline-none"
            />
          </div>
        </div>

        {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}

        <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
          <ToolBtn label="Attach (coming soon)" disabled>
            <Plus size={17} aria-hidden />
          </ToolBtn>
          <div className="relative">
            <ToolBtn label="Emoji" onClick={() => setEmojiOpen((o) => !o)}>
              <SmilePlus size={17} aria-hidden />
            </ToolBtn>
            {emojiOpen && (
              <>
                <button className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} aria-label="Close" tabIndex={-1} />
                <div className="absolute top-full left-0 z-50 mt-1 flex gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-2xl">
                  {EMOJI_PALETTE.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => insertEmoji(e)}
                      className="grid size-8 place-items-center rounded-lg text-[18px] transition-colors duration-150 hover:bg-surface-2"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <ToolBtn label="Bold" onClick={() => wrap('**')}>
            <Bold size={15} aria-hidden />
          </ToolBtn>
          <ToolBtn label="Italic" onClick={() => wrap('*')}>
            <Italic size={15} aria-hidden />
          </ToolBtn>
          <ToolBtn label="Strikethrough" onClick={() => wrap('~~')}>
            <Strikethrough size={15} aria-hidden />
          </ToolBtn>

          <button
            type="button"
            onClick={submit}
            disabled={busy || title.trim().length < 3}
            aria-label="Post request"
            title="Post request"
            className="ml-auto grid size-9 place-items-center rounded-full bg-accent text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            <ArrowUp size={18} aria-hidden />
          </button>
        </div>
      </div>
    </>
  )
}

function ToolBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  )
}
