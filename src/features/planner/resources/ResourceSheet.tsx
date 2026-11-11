import { useState } from 'react'
import { ArrowUpRight, CalendarCheck, Check, Clock, Copy, Mail, MapPin, Phone, Users } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { RESOURCE_GROUPS, type Resource } from '@/data/resources'
import { PHOTOS } from '@/data/resource-photos'
import { GROUP_ART } from './guide-toc'
import { GROUP_LOOK, groupOf, wash } from './resource-icons'

/**
 * One office, in full. It opens with the same tinted photograph its category
 * wears on the page, so the pop-up belongs to what you tapped, then gives the
 * ways to reach them as large tiles with the main action first.
 */
export function ResourceSheet({ r, onClose }: { r: Resource; onClose: () => void }) {
  const group = groupOf(r.name, RESOURCE_GROUPS)
  const look = GROUP_LOOK[group]
  const art = GROUP_ART[group]
  const Icon = look.icon
  return (
    <ModalShell label={r.name} onClose={onClose} widthClass="sm:max-w-lg">
      <header className="relative isolate overflow-hidden px-5 pt-12 pb-5 text-white sm:px-6" style={{ backgroundColor: look.hex }}>
        <img
          src={PHOTOS[art.photo].src}
          alt=""
          className="absolute inset-0 -z-20 size-full object-cover opacity-75 mix-blend-luminosity grayscale"
        />
        <span aria-hidden className="absolute inset-0 -z-10 mix-blend-multiply" style={{ backgroundColor: look.hex, opacity: 0.6 }} />
        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <span className="grid size-12 place-items-center rounded-full bg-white/20 backdrop-blur-md">
          <Icon size={22} aria-hidden />
        </span>
        <p className="mt-3 text-[12px] font-semibold tracking-[0.12em] text-white/75 uppercase">{look.short}</p>
        <h3 className="mt-0.5 font-display text-[24px] leading-tight font-bold text-balance sm:text-[26px]">{r.name}</h3>
        <p className="mt-2 text-[14.5px] leading-relaxed text-white/85">{r.what}</p>
      </header>

      <div className="space-y-4 p-5 sm:p-6">
        {(r.email || r.phone || r.where || r.hours) && (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {/* An address is one unbroken word, so it always gets the full row. */}
            {r.email && <Tile icon={Mail} label="Email" text={r.email} hex={look.hex} copy wide />}
            {r.phone && <Tile icon={Phone} label="Phone" text={r.phone} hex={look.hex} copy wide={!r.where || !!r.hours} />}
            {r.where && <Tile icon={MapPin} label="Where" text={r.where} hex={look.hex} wide={!r.phone || !!r.hours} />}
            {r.hours && <Tile icon={Clock} label="Hours" text={r.hours} hex={look.hex} wide />}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {r.bookUrl && (
            <a href={r.bookUrl} target="_blank" rel="noreferrer noopener" className={primary} style={{ backgroundColor: look.hex }}>
              <CalendarCheck size={16} aria-hidden /> Book an appointment
            </a>
          )}
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer noopener"
            className={r.bookUrl ? secondary : primary}
            style={r.bookUrl ? undefined : { backgroundColor: look.hex }}
          >
            Official page <ArrowUpRight size={15} aria-hidden />
          </a>
          {r.listUrl && r.listUrl !== r.url && (
            <a href={r.listUrl} target="_blank" rel="noreferrer noopener" className={secondary}>
              <Users size={15} aria-hidden /> Staff list
            </a>
          )}
        </div>
        <p className="text-[11.5px] leading-relaxed text-subtle">
          Copied from the official page in November 2026. If something here is out of date, the page is right.
        </p>
      </div>
    </ModalShell>
  )
}

/** One way to reach the office. Email and phone copy on tap. */
function Tile({
  icon: Icon,
  label,
  text,
  hex,
  copy,
  wide,
}: {
  icon: typeof Mail
  label: string
  text: string
  hex: string
  copy?: boolean
  /** Take the full row when its neighbour is missing. */
  wide?: boolean
}) {
  const [done, setDone] = useState(false)
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: wash(hex, 0.18), color: hex }}>
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-[0.1em] text-subtle uppercase">{done ? 'Copied' : label}</span>
        <span className="block text-[13.5px] leading-snug font-medium break-words text-fg">{text}</span>
      </span>
      {copy && (done ? <Check size={15} className="shrink-0 text-success" aria-hidden /> : <Copy size={14} className="shrink-0 text-subtle" aria-hidden />)}
    </>
  )
  const cls = 'flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2/50 p-3 text-left'
  return (
    <li className={wide ? 'sm:col-span-2' : undefined}>
      {copy ? (
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}: ${text}`}
          onClick={() => {
            navigator.clipboard
              ?.writeText(text)
              .then(() => {
                setDone(true)
                window.setTimeout(() => setDone(false), 1600)
              })
              .catch(() => {})
          }}
          className={`${cls} transition-colors duration-150 hover:border-border-strong hover:bg-surface-2`}
        >
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}

const primary =
  'inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold text-white transition-[filter] duration-150 hover:brightness-110'
const secondary =
  'inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-[14px] font-medium text-fg transition-colors duration-150 hover:border-border-strong hover:bg-surface-2'
