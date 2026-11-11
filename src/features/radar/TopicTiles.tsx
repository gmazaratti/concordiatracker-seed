import { Check } from 'lucide-react'
import { PHOTOS } from '@/data/resource-photos'
import { cn } from '@/lib/cn'
import { TOPIC } from './radar-look'
import type { Signal } from './rules'

const ORDER: Signal['topic'][] = ['load', 'deadlines', 'grades', 'coverage']

/**
 * The four things Radar looks at, as picture tiles with how many findings each
 * has. They are the map of the page: one look says where the trouble is, and
 * tapping one narrows the findings to it (tap again to see everything).
 */
export function TopicTiles({
  counts,
  active,
  onPick,
}: {
  counts: Record<Signal['topic'], number>
  active: Signal['topic'] | null
  onPick: (t: Signal['topic'] | null) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {ORDER.map((id, i) => {
        const topic = TOPIC[id]
        const n = counts[id]
        const on = active === id
        const Icon = topic.icon
        return (
          <button
            key={id}
            type="button"
            onClick={() => onPick(on ? null : id)}
            aria-pressed={on}
            className={cn(
              'ct-res-in group relative isolate flex min-h-[124px] flex-col justify-between overflow-hidden rounded-2xl p-3.5 text-left text-white transition-[transform,box-shadow,opacity] duration-300 hover:-translate-y-1 active:scale-[0.98]',
              on && 'ring-2 ring-white/80',
              active && !on && 'opacity-55',
            )}
            style={{ animationDelay: `${i * 45}ms`, backgroundColor: topic.hex }}
          >
            <img
              src={PHOTOS[topic.photo].src}
              alt=""
              loading="lazy"
              className="absolute inset-0 -z-20 size-full object-cover opacity-70 mix-blend-luminosity grayscale transition-transform duration-700 ease-out group-hover:scale-110"
            />
            <span aria-hidden className="absolute inset-0 -z-10 mix-blend-multiply" style={{ backgroundColor: topic.hex, opacity: 0.6 }} />
            <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <span className="flex items-start justify-between gap-2">
              <span className="grid size-10 place-items-center rounded-full bg-white/20 backdrop-blur-md">
                <Icon size={19} aria-hidden />
              </span>
              {n > 0 ? (
                <span className="font-display text-[34px] leading-none font-bold tabular-nums">{n}</span>
              ) : (
                <span className="grid size-7 place-items-center rounded-full bg-white/25 backdrop-blur-md" title="Clear">
                  <Check size={15} strokeWidth={3} aria-hidden />
                </span>
              )}
            </span>
            <span>
              <span className="block text-[15px] leading-tight font-semibold">{topic.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-white/80">
                {n === 0 ? 'Nothing found' : n === 1 ? '1 thing to look at' : `${n} things to look at`}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
