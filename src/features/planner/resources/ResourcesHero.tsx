import { useState } from 'react'
import { BookOpenText, Building2, Search, ShieldAlert, Users, X } from 'lucide-react'
import { PHOTOS } from '@/data/resource-photos'
import { SEARCH_PROMPTS, useTypedPlaceholder } from './useTypedPlaceholder'

/**
 * The banner: a real photograph of the Hall Building plaza, the search, and the
 * one number that should never be more than a glance away. It commits to one
 * look (white type over a darkened photo) in every theme, because the picture
 * does not change with the palette and the text has to stay readable on it.
 */
export function ResourcesHero({
  q,
  setQ,
  firstName,
  counts,
}: {
  q: string
  setQ: (v: string) => void
  firstName: string
  counts: { offices: number; advisors: number; guides: number }
}) {
  const [focused, setFocused] = useState(false)
  // Typed out while the field is empty and idle; it gets out of the way the
  // moment you click in, so you never type over a moving placeholder.
  const typed = useTypedPlaceholder(SEARCH_PROMPTS, focused || q !== '')
  return (
    <header className="ct-res-in relative isolate overflow-hidden rounded-3xl bg-[#0b0d16] text-white">
      <img
        src={PHOTOS.plaza.src}
        alt={PHOTOS.plaza.alt}
        className="ct-res-kenburns absolute inset-0 -z-20 size-full object-cover object-[60%_35%]"
      />
      {/* Darkened toward the text; the photo keeps its own muted greys. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(100deg, rgba(8,10,20,0.94) 0%, rgba(8,10,20,0.82) 38%, rgba(8,10,20,0.28) 72%, rgba(8,10,20,0.12) 100%), linear-gradient(0deg, rgba(8,10,20,0.75), transparent 45%)',
        }}
      />
      <div className="px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6 lg:max-w-[62%] 2xl:pt-11 2xl:pb-8">
        <p className="text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">Concordia, sorted</p>
        <h2 className="mt-2 font-display text-[28px] leading-[1.06] font-bold tracking-tight text-balance sm:text-[34px] 2xl:text-[44px]">
          {firstName ? `${firstName}, who do you need to talk to?` : 'Who do you need to talk to?'}
        </h2>
        <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-white/80">
          Every office, the advisors behind them, and guides written for where you are in your degree.
        </p>
        <label style={{ ['--ct-ring' as string]: '#ffffff' }} className="ct-ring relative isolate mt-4 flex max-w-md items-center gap-2.5 rounded-2xl border border-white/20 bg-white/[0.12] px-3.5 py-2.5 backdrop-blur-md transition-colors duration-150 focus-within:border-white/60 focus-within:bg-white/[0.18]">
          <Search size={17} className="shrink-0 text-white/70" aria-hidden />
          {/* A light travelling round the outline: it says "this is the thing to use". */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={focused ? 'Search offices and guides' : `${typed}|`}
            aria-label="Search resources and guides"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/55 sm:text-[14.5px]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="grid size-6 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
        <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
          <Stat icon={Building2} n={counts.offices} label="offices" />
          <Stat icon={Users} n={counts.advisors} label="advisors" />
          <Stat icon={BookOpenText} n={counts.guides} label="guides" />
        </ul>
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-white/10 bg-black/30 px-5 py-2.5 text-[12.5px] text-white/80 backdrop-blur-sm sm:px-9">
        <ShieldAlert size={14} className="text-[#ff8f8f]" aria-hidden />
        Campus emergency, any hour:
        <span className="font-semibold text-white select-all">514-848-3717</span>
      </p>
    </header>
  )
}

function Stat({ icon: Icon, n, label }: { icon: typeof Users; n: number; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
      <Icon size={13} className="text-white/70" aria-hidden />
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-white/75">{label}</span>
    </li>
  )
}
