import { Fragment, useEffect, useRef, useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { useSettings } from '@/app/providers/settings'
import { badgeForPerson } from './badges'
import { useCommunityData } from '@/app/providers/community-data'
import { chatTheme } from './chat-themes'
import {
  sendMessage,
  type Attachment,
  type Friend,
  type Message,
} from '@/lib/social'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AttachSheet } from './AttachSheet'
import { useAttachSource } from './chat/useAttachSource'
import { useChatThread } from './chat/useChatThread'
import { seenLabel } from '@/lib/message-extras'
import { useChatExtras } from './chat/useChatExtras'
import { MessageRow } from './chat/MessageRow'
import { MessageMenu } from './chat/MessageMenu'
import { MessageInfo, ReportDialog } from './chat/MessageDialogs'
import { ChatHeader } from './chat/ChatHeader'
import { ChatComposer } from './chat/ChatComposer'
import { Avatar } from './chat/ChatAvatar'
import { quoteOf } from './chat/chat-helpers'
import { cn } from '@/lib/cn'

/**
 * One conversation.
 *
 * The thing students actually want from a chat inside a school app is not
 * chat — it is sending each other the objects the app already holds. "When are
 * your classes", "send me that outline", "are you going to this". So the
 * composer leads with a + that attaches a REFERENCE to a schedule, a class or
 * an event, and the recipient opens the live thing rather than a screenshot
 * that stopped being true in March.
 *
 * Everything that could be faked is not: read receipts come from `read_at` on
 * the row, and typing is a broadcast that carries no history and is never
 * stored. A chat that invents either is a chat you stop believing.
 */
export function Chat({
  friend,
  onBack,
  initialAttachment,
  unreadOnOpen = 0,
  className,
}: {
  friend: Friend
  onBack?: () => void
  /**
   * How many of theirs were unread the moment you opened this, counted by the
   * list that opened it.
   *
   * IT CANNOT BE DERIVED HERE. Opening a conversation marks it read — the
   * list does it optimistically so the badge clears instantly, and this
   * component does it again on load — so by the time the messages arrive
   * `read_at` is already set on every one of them and there is nothing left
   * to divide. The count has to be carried in from before that happened.
   */
  unreadOnOpen?: number
  /** Pre-loaded from a Share button elsewhere, so "send this to a friend"
   *  lands in the composer rather than making you find it again in the +. */
  initialAttachment?: Attachment
  className?: string
}) {
  const { plan } = useAppData()
  const { uiState, patchUiState } = useUiState()
  const { openSettings } = useSettings()

  const [body, setBody] = useState('')
  const [pending, setPending] = useState<Attachment | null>(initialAttachment ?? null)
  const [error, setError] = useState<string | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [menu, setMenu] = useState<{ m: Message; x: number; y: number } | null>(null)
  const [info, setInfo] = useState<Message | null>(null)
  const [reporting, setReporting] = useState<Message | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const theme = chatTheme(uiState.chatThemes?.[friend.user_id])
  /** An attachment with no words is a message too, which is why this is not
   *  just `body.trim()`. */
  const canSend = !!body.trim() || !!pending
  const pro = plan !== 'free'
  const { orgNameByOwner } = useCommunityData()
  const badge = badgeForPerson(friend.handle, orgNameByOwner[friend.user_id])

  const { rows, schedules, me, theyType, reload, announceTyping } = useChatThread(friend.user_id)

  useEffect(() => {
    /*
     * The CONTAINER is scrolled, not the element scrolled into view.
     * `scrollIntoView` walks up and scrolls EVERY scrollable ancestor, so on
     * desktop sending a message dragged the whole page down and took the
     * composer off the bottom of the screen with it.
     */
    const box = endRef.current?.parentElement
    if (box) box.scrollTop = box.scrollHeight
  }, [rows, theyType])

  /**
   * WHERE YOU LEFT OFF.
   *
   * Frozen the first time a conversation loads, and deliberately not
   * recomputed: opening the thread marks it read, and a message that arrives
   * while you are looking at it is not one you missed. Recomputing from
   * `read_at` on every refetch would drop a second divider above every live
   * message, which is the opposite of what the line is for.
   */
  const [divider, setDivider] = useState<{ friend: string; id: string | null }>({
    friend: '',
    id: null,
  })
  if (rows && divider.friend !== friend.user_id) {
    // Walk back from the newest, counting only THEIRS, until the count they
    // were unread by is used up. That message is the first one you had not
    // seen.
    let left = unreadOnOpen
    let at: string | null = null
    for (let i = rows.length - 1; i >= 0 && left > 0; i--) {
      if (rows[i].sender === me) continue
      left -= 1
      if (left === 0) at = rows[i].id
    }
    // Nothing above it to divide from means nothing to draw.
    setDivider({ friend: friend.user_id, id: at && rows[0]?.id !== at ? at : null })
  }

  async function submit() {
    if (!body.trim() && !pending) return
    const msg = await sendMessage(friend.user_id, body || ' ', pending ?? undefined, replyTo?.id)
    if (msg) return setError(msg)
    setBody('')
    setPending(null)
    setReplyTo(null)
    setError(null)
    reload()
  }

  /**
   * Everything you can send, grouped by what it is.
   *
   * `now` is read once into state rather than during render: the clock is
   * impure, and a memo that re-derives "upcoming" on every re-render can drop
   * an event out of the list mid-scroll.
   */
  const [now] = useState(() => Date.now())

  const extras = useChatExtras(friend.user_id, rows, me)
  const otherName = friend.name ?? `@${friend.handle}`
  // The newest message YOU sent: the one that carries "Seen ..." underneath.
  const lastMine = [...(rows ?? [])].reverse().find((r) => r.sender === me)?.id

  const attachSource = useAttachSource(schedules)

  return (
    <div
      /* `min-w-0`: on a phone this column sits in a ROW flex overlay, and a
         flex item's minimum width is its content — so one long name widened
         the whole conversation past the screen and took the header's icons
         and the composer's send button out of frame with it. */
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}
      style={theme.bg ? { backgroundColor: theme.bg } : undefined}
    >
      <ChatHeader
        friend={friend}
        badge={badge}
        onBack={onBack}
        receipts={extras.receipts.mine}
        onReceipts={extras.setMine}
        theme={theme}
        pro={pro}
        onTheme={(id) => patchUiState({ chatThemes: { ...uiState.chatThemes, [friend.user_id]: id } })}
        onUpgrade={() => openSettings('billing')}
      />
      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {rows === null && <p className="text-[12px] text-subtle">Loading…</p>}
        {rows?.length === 0 && (
          <p className="py-8 text-center text-[12px] text-subtle">
            Nothing here yet. Send them your schedule with the + below.
          </p>
        )}
        {(rows ?? []).map((m, i) => {
          const mine = m.sender === me
          const prev = (rows ?? [])[i - 1]
          const next = (rows ?? [])[i + 1]
          // Only the last of a run gets a tail and a timestamp, so a burst of
          // three reads as one thought rather than three notifications.
          const grouped = prev?.sender === m.sender
          /**
           * THE AVATAR BELONGS ON THE LAST MESSAGE OF A RUN, not the first.
           *
           * The row is `items-end`, so the face sits level with the bottom
           * bubble — which is where the eye already is after reading three
           * messages downward, and where every messenger puts it. On the first
           * message it floats level with the top of a block it is not the end
           * of, and the run reads as starting from nowhere.
           */
          const endsRun = next?.sender !== m.sender
          return (
            <ErrorBoundary
              key={m.id}
              resetKey={m.id}
              label="This message couldn't be displayed"
              className={cn(mine ? 'ml-auto max-w-[78%]' : 'mr-auto max-w-[78%]')}
            >
            <Fragment>
              {divider.id === m.id && (
                <div className="flex items-center gap-3 py-2" role="separator">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium tracking-wide text-subtle">
                    New messages
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
            <MessageRow
              m={m}
              mine={mine}
              grouped={grouped}
              avatar={
                <span className={cn('shrink-0', !endsRun && 'invisible')}>
                  <Avatar friend={friend} size={26} />
                </span>
              }
              quote={quoteOf(m, rows ?? [], me, otherName)}
              reactions={extras.byMessage.get(m.id) ?? []}
              me={me}
              tick={mine && extras.receipts.shared ? { read: extras.readAt[m.id] ?? null } : null}
              footer={
                mine && extras.receipts.shared && m.id === lastMine
                  ? extras.readAt[m.id]
                    ? seenLabel(extras.readAt[m.id], now)
                    : 'Sent'
                  : null
              }
              bubbleStyle={mine && theme.bubble ? { backgroundColor: theme.bubble, color: theme.bubbleText } : undefined}
              onMenu={(x, y) => setMenu({ m, x, y })}
              onReact={(e) => extras.react(m.id, e)}
            />
            </Fragment>
            </ErrorBoundary>
          )
        })}

        {theyType && (
          <div className="ct-msg-in flex items-end gap-2">
            <Avatar friend={friend} size={24} />
            <div className="rounded-2xl rounded-bl-md border border-border bg-surface-2 px-3 py-2.5">
              <span className="flex items-center gap-1" aria-label="Typing">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="ct-typing-dot size-1.5 rounded-full bg-subtle"
                    style={{ animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <ChatComposer
        ref={inputRef}
        body={body}
        onBody={(v) => {
          setBody(v)
          announceTyping()
        }}
        onSubmit={() => void submit()}
        placeholder={`Message ${friend.name ?? friend.handle}`}
        canSend={canSend}
        attachOpen={attachOpen}
        onAttach={() => setAttachOpen(true)}
        pending={pending}
        onClearPending={() => setPending(null)}
        replyTo={replyTo}
        replyName={replyTo?.sender === me ? 'yourself' : otherName}
        onClearReply={() => setReplyTo(null)}
        notice={notice}
        warning={extras.error}
        error={error}
      />
      {attachOpen && (
        <AttachSheet
          source={attachSource}
          onPick={setPending}
          onClose={() => setAttachOpen(false)}
        />
      )}

      {menu && (
        <MessageMenu
          x={menu.x}
          y={menu.y}
          mine={extras.byMessage.get(menu.m.id)?.find((r) => r.userId === me)?.emoji ?? null}
          onClose={() => setMenu(null)}
          onReact={(e) => extras.react(menu.m.id, e)}
          onReply={() => {
            setReplyTo(menu.m)
            inputRef.current?.focus()
          }}
          onInfo={() => setInfo(menu.m)}
          onCopy={menu.m.body.trim() ? () => void navigator.clipboard?.writeText(menu.m.body) : undefined}
          onReport={menu.m.sender !== me ? () => setReporting(menu.m) : undefined}
        />
      )}
      {info && (
        <MessageInfo
          message={info}
          mine={info.sender === me}
          otherName={otherName}
          readAt={extras.readAt[info.id]}
          shared={extras.receipts.shared}
          reactions={extras.byMessage.get(info.id) ?? []}
          me={me}
          onClose={() => setInfo(null)}
        />
      )}
      {reporting && (
        <ReportDialog
          message={reporting}
          from={{ name: friend.name, handle: friend.handle }}
          onClose={() => setReporting(null)}
          onDone={(caseId) => {
            setReporting(null)
            setNotice(`Reported${caseId ? ` (${caseId})` : ''}. Thanks, we will look at it.`)
          }}
        />
      )}
    </div>
  )
}

export { Avatar }
