import { ArrowUpRight, CalendarCheck } from 'lucide-react'
import { NEEDS, findResource } from '@/data/resource-guide'
import { RESOURCE_GROUPS, type Resource } from '@/data/resources'
import { cn } from '@/lib/cn'
import { PHOTOS } from '@/data/resource-photos'
import { GROUP_ART, NEED_PHOTO } from './guide-toc'
import { GROUP_LOOK, NEED_ICON, wash } from './resource-icons'

/** "I need..." shortcuts: eight plain-language doors, each opening one office. */
export function NeedGrid({ faculty, onOpen }: { faculty: Resource['faculty'] | null; onOpen: (r: Resource) => void }) {
  return (
    <section aria-labelledby="res-needs">
      <h3 id="res-needs" className="font-display text-[22px] font-semibold tracking-tight text-fg">
        I need
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {NEEDS.map((n, i) => {
          const r = findResource(n.resource, faculty)
          if (!r) return null
          const look = GROUP_LOOK[n.group]
          const Icon = NEED_ICON[n.id]
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onOpen(r)}
              className="ct-res-in group relative isolate flex min-h-[132px] flex-col justify-between overflow-hidden rounded-2xl p-3.5 text-left text-white transition-transform duration-300 hover:-translate-y-1 active:scale-[0.98]"
              style={{ animationDelay: `${i * 35}ms`, backgroundColor: look.hex }}
            >
              <img
                src={PHOTOS[NEED_PHOTO[n.id]].src}
                alt=""
                loading="lazy"
                className="absolute inset-0 -z-20 size-full object-cover opacity-70 mix-blend-luminosity grayscale transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <span aria-hidden className="absolute inset-0 -z-10 mix-blend-multiply" style={{ backgroundColor: look.hex, opacity: 0.6 }} />
              <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <span className="grid size-10 place-items-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                <Icon size={19} aria-hidden />
              </span>
              <span className="mt-3 flex items-end justify-between gap-2">
                <span className="text-[14px] leading-snug font-semibold text-balance">{n.label}</span>
                <ArrowUpRight
                  size={15}
                  className="mb-0.5 shrink-0 text-white/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
                  aria-hidden
                />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Everything, one category at a time. The old page stacked all seven groups
 * with full contact details on every card; here a category is a tab, a tile is
 * a name and a line, and the details open on tap.
 */
export function Directory({
  group,
  setGroup,
  mine,
  onOpen,
}: {
  group: string
  setGroup: (id: string) => void
  mine: Resource['faculty'] | null
  onOpen: (r: Resource) => void
}) {
  const active = RESOURCE_GROUPS.find((g) => g.id === group) ?? RESOURCE_GROUPS[0]
  const items = [...active.items].sort((a, b) => Number(!!mine && b.faculty === mine) - Number(!!mine && a.faculty === mine))
  return (
    <section aria-labelledby="res-dir">
      <h3 id="res-dir" className="font-display text-[22px] font-semibold tracking-tight text-fg">
        Every office
      </h3>
      <div role="tablist" aria-label="Category" className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:flex-wrap lg:overflow-visible">
        {RESOURCE_GROUPS.map((g) => {
          const look = GROUP_LOOK[g.id]
          const on = g.id === active.id
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setGroup(g.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
                on ? 'border-transparent text-fg' : 'border-border text-muted hover:border-border-strong hover:text-fg',
              )}
              style={on ? { backgroundColor: wash(look.hex, 0.26) } : undefined}
            >
              <span className="size-2.5 rounded-full" style={{ backgroundColor: look.hex }} aria-hidden />
              {look.short}
              <span className="text-[11.5px] text-subtle tabular-nums">{g.items.length}</span>
            </button>
          )
        })}
      </div>
      <CategoryBanner key={active.id} id={active.id} title={active.title} count={items.length} />
      <TileGrid key={`t-${active.id}`} items={items} mine={mine} onOpen={onOpen} />
    </section>
  )
}

/** The open category, introduced by a photograph in its own colour. */
function CategoryBanner({ id, title, count }: { id: string; title: string; count: number }) {
  const look = GROUP_LOOK[id]
  const art = GROUP_ART[id]
  const Icon = look.icon
  return (
    <div
      className="ct-res-in relative isolate mt-3 flex min-h-[150px] items-end overflow-hidden rounded-3xl p-5 text-white sm:min-h-[170px] sm:p-6"
      style={{ backgroundColor: look.hex }}
    >
      <img
        src={PHOTOS[art.photo].src}
        alt=""
        loading="lazy"
        className="absolute inset-0 -z-20 size-full object-cover opacity-75 mix-blend-luminosity grayscale"
      />
      <span aria-hidden className="absolute inset-0 -z-10 mix-blend-multiply" style={{ backgroundColor: look.hex, opacity: 0.55 }} />
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
      <div className="flex min-w-0 items-end gap-4">
        <span className="hidden size-12 shrink-0 place-items-center rounded-full bg-white/20 backdrop-blur-md sm:grid">
          <Icon size={22} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-[0.12em] text-white/75 uppercase">
            {count} {count === 1 ? 'office' : 'offices'}
          </p>
          <p className="mt-0.5 font-display text-[24px] leading-tight font-bold text-balance sm:text-[28px]">{title}</p>
          <p className="mt-1 max-w-xl text-[13.5px] leading-snug text-white/85">{art.blurb}</p>
        </div>
      </div>
    </div>
  )
}

export function TileGrid({
  items,
  mine,
  onOpen,
}: {
  items: Resource[]
  mine: Resource['faculty'] | null
  onOpen: (r: Resource) => void
}) {
  return (
    <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((r, i) => {
        const look = GROUP_LOOK[RESOURCE_GROUPS.find((g) => g.items.includes(r))?.id ?? 'advising']
        const Icon = look.icon
        const yours = !!mine && r.faculty === mine
        return (
          <button
            key={r.name}
            type="button"
            onClick={() => onOpen(r)}
            className={cn(
              'ct-res-in group flex items-start gap-3 rounded-2xl border bg-surface p-3.5 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5',
              yours ? 'border-accent/60' : 'border-border hover:border-border-strong',
            )}
            style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
          >
            <span
              className="grid size-10 shrink-0 place-items-center rounded-full text-white"
              style={{ backgroundColor: look.hex }}
            >
              <Icon size={18} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start gap-1.5">
                <span className="min-w-0 flex-1 text-[14px] leading-snug font-semibold text-fg">{r.name}</span>
                <ArrowUpRight
                  size={15}
                  className="mt-0.5 shrink-0 text-subtle transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-fg"
                  aria-hidden
                />
              </span>
              <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-muted">{r.what}</span>
              {(yours || r.bookUrl) && (
                <span className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  {yours && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">Your faculty</span>}
                  {r.bookUrl && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                      <CalendarCheck size={10} aria-hidden /> Bookable
                    </span>
                  )}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
