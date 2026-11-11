import { useState } from 'react'
import { CalendarCheck, Check, Clock, Copy, ExternalLink, Mail, MapPin, Phone, Users } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { RESOURCE_GROUPS, type Resource } from '@/data/resources'
import { GROUP_LOOK, groupOf } from './resource-icons'

/**
 * One office, in full. The directory shows names and one line each; everything
 * you would actually need to reach them lives here, so the page itself stays
 * scannable.
 */
export function ResourceSheet({ r, onClose }: { r: Resource; onClose: () => void }) {
  const look = GROUP_LOOK[groupOf(r.name, RESOURCE_GROUPS)]
  const Icon = look.icon
  return (
    <ModalShell label={r.name} onClose={onClose}>
      <div className="p-5">
        <div className="flex items-start gap-3 pr-8">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-full text-white"
            style={{ backgroundColor: look.hex }}
          >
            <Icon size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium text-subtle">{look.short}</p>
            <h3 className="font-display text-[19px] leading-snug font-semibold text-fg">{r.name}</h3>
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">{r.what}</p>

        <ul className="mt-4 divide-y divide-border/70 rounded-2xl border border-border bg-canvas/40">
          {r.email && <CopyLine icon={Mail} text={r.email} label="email" />}
          {r.phone && <CopyLine icon={Phone} text={r.phone} label="phone number" />}
          {r.where && <Line icon={MapPin} text={r.where} />}
          {r.hours && <Line icon={Clock} text={r.hours} />}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          {r.bookUrl && (
            <a href={r.bookUrl} target="_blank" rel="noreferrer noopener" className={primary}>
              <CalendarCheck size={15} aria-hidden /> Book an appointment
            </a>
          )}
          <a href={r.url} target="_blank" rel="noreferrer noopener" className={r.bookUrl ? secondary : primary}>
            Official page <ExternalLink size={14} aria-hidden />
          </a>
          {r.listUrl && r.listUrl !== r.url && (
            <a href={r.listUrl} target="_blank" rel="noreferrer noopener" className={secondary}>
              <Users size={14} aria-hidden /> Staff list
            </a>
          )}
        </div>
        <p className="mt-4 text-[11.5px] text-subtle">
          Copied from the official page in November 2026. If something here is out of date, the page is right.
        </p>
      </div>
    </ModalShell>
  )
}

function Line({ icon: Icon, text }: { icon: typeof Mail; text: string }) {
  return (
    <li className="flex items-start gap-2.5 px-3.5 py-2.5 text-[13.5px] text-fg">
      <Icon size={15} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
      <span className="min-w-0 break-words">{text}</span>
    </li>
  )
}

function CopyLine({ icon: Icon, text, label }: { icon: typeof Mail; text: string; label: string }) {
  const [done, setDone] = useState(false)
  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setDone(true)
        window.setTimeout(() => setDone(false), 1600)
      })
      .catch(() => {})
  }
  return (
    <li className="flex items-center gap-2.5 px-3.5 py-2 text-[13.5px] text-fg">
      <Icon size={15} className="shrink-0 text-subtle" aria-hidden />
      <span className="min-w-0 flex-1 break-all select-all">{text}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        {done ? <Check size={15} className="text-success" aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
    </li>
  )
}

const primary =
  'inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-[13.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover'
const secondary =
  'inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13.5px] font-medium text-fg transition-colors duration-150 hover:border-border-strong hover:bg-surface-2'
