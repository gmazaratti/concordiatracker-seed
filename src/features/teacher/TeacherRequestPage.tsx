import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Mail, Search, UserPlus } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import type { AccessRequest, RequestStatus } from '@/data/teacher'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const SUPPORT_EMAIL = 'concordiatracker@gmail.com'
const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

function reqAgo(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/** Self-serve access request for prospective teachers + a Case-ID status check.
 * STUB / CONNECTION-PHASE: there's no real review pipeline; the admin flips the
 * status in-memory and the requester checks back by Case ID. */
export function TeacherRequestPage() {
  const { submitAccessRequest, getRequest } = useTeacher()
  const [mode, setMode] = useState<'request' | 'check'>('request')

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-5 py-14">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
          <UserPlus size={22} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[22px] leading-tight font-semibold text-fg">
          Request teacher access
        </h1>
        <p className="mt-1 text-[13px] text-subtle">
          Teachers join by invitation — request one and we'll review it.
        </p>

        <div role="tablist" className="mt-4 mb-4 flex gap-1 rounded-lg bg-surface-2 p-1">
          {(['request', 'check'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150',
                mode === m ? 'bg-accent text-accent-contrast' : 'text-muted hover:text-fg',
              )}
            >
              {m === 'request' ? 'Request access' : 'Check a request'}
            </button>
          ))}
        </div>

        {mode === 'request' ? (
          <RequestForm onSubmit={submitAccessRequest} />
        ) : (
          <CheckForm onLookup={getRequest} />
        )}
      </div>

      <p className="mt-4 text-center text-[12px] text-subtle">
        Already approved?{' '}
        <Link to="/teacher" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

function RequestForm({
  onSubmit,
}: {
  onSubmit: (input: { name: string; email: string; message: string }) => AccessRequest
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState<AccessRequest | null>(null)

  if (done) return <Submitted req={done} />

  const valid = name.trim() && email.trim()

  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">Full name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Smith" className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">School email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@concordia.ca"
          className={field}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">
          What do you teach? <span className="text-subtle">(optional)</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="e.g. COMP 352 — Data Structures, section AA"
          className={cn(field, 'resize-none')}
        />
      </label>

      <Button
        className="mt-1 w-full"
        disabled={!valid}
        onClick={() =>
          valid && setDone(onSubmit({ name: name.trim(), email: email.trim(), message: message.trim() }))
        }
      >
        Submit request
      </Button>
    </div>
  )
}

function Submitted({ req }: { req: AccessRequest }) {
  return (
    <div>
      <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 px-3.5 py-3">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="text-[13px] font-medium text-success">Request submitted</p>
          <p className="mt-0.5 text-[12px] text-muted">
            Your case ID is <strong className="font-semibold text-fg">{req.caseId}</strong> — keep
            it to check your status.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3">
        <Mail size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <p className="text-[12px] leading-relaxed text-subtle">
          To speed up approval and verify your identity, also email us from your school address at{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Teacher access request ${req.caseId}`}
            className="font-medium text-accent hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>

      <div className="mt-3">
        <RequestStatusView req={req} />
      </div>
    </div>
  )
}

function CheckForm({ onLookup }: { onLookup: (caseId: string) => AccessRequest | undefined }) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AccessRequest | null | undefined>(undefined)

  function check() {
    const raw = input.trim().toUpperCase()
    if (!raw) return
    const id = raw.startsWith('REQ-') ? raw : `REQ-${raw.replace(/^REQ-?/, '')}`
    setResult(onLookup(id) ?? null)
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            placeholder="Case ID, e.g. REQ-1041"
            aria-label="Case ID"
            className={cn(field, 'pl-9')}
          />
        </div>
        <Button onClick={check}>Check</Button>
      </div>

      {result === null && (
        <p className="mt-3 rounded-lg border border-border bg-surface-2/50 px-3.5 py-3 text-center text-[12px] text-subtle">
          No request found for that case ID.
        </p>
      )}
      {result && (
        <div className="mt-3">
          <RequestStatusView req={result} />
        </div>
      )}
    </div>
  )
}

const STATUS_STYLE: Record<RequestStatus, string> = {
  pending: 'bg-warning/15 text-warning',
  accepted: 'bg-success/15 text-success',
  denied: 'bg-danger/15 text-danger',
}

export function RequestStatusView({ req }: { req: AccessRequest }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-fg">{req.caseId}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
            STATUS_STYLE[req.status],
          )}
        >
          {req.status}
        </span>
        <span className="ml-auto text-[11px] text-subtle">Requested {reqAgo(req.requestedDaysAgo)}</span>
      </div>
      <p className="mt-1 text-[12px] text-subtle">
        {req.status === 'pending'
          ? 'Under review — check back here with your case ID.'
          : req.status === 'accepted'
            ? 'Approved — an invite has been sent to your email.'
            : 'Not approved this time. Contact us if you think this is a mistake.'}
      </p>
    </div>
  )
}
