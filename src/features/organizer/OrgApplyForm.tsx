import { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { Select } from '@/components/ui/Select'
import { CATEGORY_META, CATEGORY_ORDER } from '@/features/community/category'

const SIZES = ['Under 25', '25–100', '100–500', '500+', 'Not sure yet']

const suggestHandle = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'club'

const field =
  'w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[14px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

/**
 * The application — for a club nobody invited.
 *
 * SHORT ON PURPOSE. Seven questions, most of them one tap or one line. Every
 * field earns its place by being something the approval decision actually
 * turns on: is this a real club, what will it post, and who is asking. A
 * longer form would filter out the busy exec we most want, and we can ask
 * anything else in a reply.
 *
 * WHAT IT IS NOT: a gate on using the product. Applying opens the dashboard
 * immediately — profile, drafts, the lot. Approval gates PUBLICATION, not
 * setup, so the wait costs nobody their evening's work.
 *
 * The answers are written by `apply_for_org` in the same statement that
 * creates the org, and become immutable to the applicant: what the admin
 * read when they approved is what stays on the row.
 */
export function OrgApplyForm({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { applyForOrg } = useTeacher()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [what, setWhat] = useState('')
  const [category, setCategory] = useState('clubs')
  const [size, setSize] = useState('')
  const [role, setRole] = useState('')
  const [proof, setProof] = useState('')
  // Prefilled from the account, editable: the address the club actually
  // answers is often a club inbox, not the president's personal one.
  const [contact, setContact] = useState(user?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const contactOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim())
  const ready = name.trim().length > 1 && what.trim().length > 4 && role.trim().length > 1 && contactOk

  async function submit() {
    if (!ready || busy) return
    setBusy(true)
    setError('')
    const err = await applyForOrg({
      name: name.trim(),
      handle: (handle.trim() || suggestHandle(name)).replace(/^@/, ''),
      answers: {
        what: what.trim(),
        category,
        size,
        role: role.trim(),
        contact: contact.trim(),
        proof: proof.trim(),
      },
    })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    onDone()
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={14} aria-hidden />
        Back
      </button>

      <h1 className="font-display text-[22px] leading-tight font-semibold text-fg">
        Apply to list your club
      </h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">
        A few quick questions. You get your dashboard straight away. We check the application before
        anything appears in the student feed.
      </p>

      <div className="mt-6 flex flex-col gap-3.5">
        <Labelled label="Club or organization name">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Concordia Robotics Club"
            maxLength={80}
            className={field}
          />
        </Labelled>

        <Labelled label="Handle" hint="How students will find you">
          <div className="flex items-center rounded-lg border border-border bg-surface-2 px-3 focus-within:border-accent">
            <span className="text-[14px] text-subtle">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
              placeholder={name ? suggestHandle(name) : 'robotics'}
              maxLength={20}
              className="ml-0.5 w-full bg-transparent py-2.5 text-[14px] text-fg placeholder:text-subtle focus:outline-none"
            />
          </div>
        </Labelled>

        <Labelled label="What is it?" hint="One or two lines students would understand">
          <textarea
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            rows={3}
            placeholder="We build competition robots and run beginner workshops every term."
            maxLength={400}
            className={`${field} resize-none`}
          />
        </Labelled>

        <Labelled label="What do you mostly post?">
          <Select
            value={category}
            onChange={setCategory}
            ariaLabel="What do you mostly post?"
            options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_META[c].label }))}
          />
        </Labelled>

        <Labelled label="Roughly how many members?">
          <Select
            value={size}
            onChange={setSize}
            ariaLabel="Roughly how many members?"
            placeholder="Pick one"
            options={SIZES.map((v) => ({ value: v, label: v }))}
          />
        </Labelled>

        <Labelled label="Your role">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="President, VP Events, …"
            maxLength={60}
            className={field}
          />
        </Labelled>

        <Labelled label="Contact email" hint="Where we reach the club about this application">
          <input
            type="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="club@example.com"
            maxLength={200}
            autoComplete="email"
            className={field}
          />
        </Labelled>

        <Labelled
          label="Anything that shows it's you"
          hint="Optional: an Instagram, a CSU page, a website. It speeds this up a lot."
        >
          <input
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="instagram.com/yourclub"
            maxLength={200}
            className={field}
          />
        </Labelled>
      </div>

      {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}

      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => void submit()}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-[14px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
      >
        {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
        Apply and open my dashboard
      </button>
      <p className="mt-2 text-center text-[12px] text-subtle">
        Nothing you post is visible to students until we approve you.
      </p>
    </div>
  )
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-fg">{label}</span>
      {hint && <span className="mt-0.5 block text-[11.5px] text-subtle">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}
