import { BellRing, CalendarDays, CalendarSync, Gift, GraduationCap, Users, type LucideIcon } from 'lucide-react'

type Tile = { icon: LucideIcon; title: string; body: string }

const TILES: Tile[] = [
  { icon: CalendarDays, title: 'Your term, layered on one calendar', body: 'Month, week and agenda views with your deadlines, your tasks and Concordia dates as layers.' },
  { icon: GraduationCap, title: 'Plan next term early', body: 'Search every Concordia course, follow prerequisite chains, and build a clash-free schedule from real sections before registration opens.' },
  { icon: CalendarSync, title: 'Subscribe from Google or Apple', body: 'One private link your calendar app subscribes to, once.\nMove a date here and the change follows it there, too.' },
  { icon: BellRing, title: 'Watch full seats', body: 'Watch a full section and get an alert when a seat opens, with the class number ready to paste into the Student Centre.' },
  { icon: Users, title: 'Campus events, straight from clubs', body: 'Follow the clubs you care about, see their events and posts in one feed, and add any event to your calendar in a tap.' },
  { icon: Gift, title: 'Free to get started', body: 'Deadlines, grade entry and the grade-needed calculator are free. The Semester pass adds GPA projection, calendar sync and more syllabus scans.' },
]

/*
 * PHONE ARRANGEMENT (below `sm`), same six tiles in the same order:
 *
 *   [ 1  wide banner, icon beside the text  ]
 *   [ 2              ] [ 3                  ]
 *   [ 4  tall visual ] [ 5                  ]
 *   [    tile        ] [ 6                  ]
 *
 * From `sm` up every per-tile class resets, so the tablet two-column grid and
 * the desktop three-column grid are exactly what they were.
 */
const PHONE: Record<number, string> = {
  0: 'col-span-2 sm:col-span-1',
  3: 'row-span-2 sm:row-span-1',
}

export function RecordlyTiles() {
  return (
    <div className="mx-auto mt-14 grid w-full max-w-[1080px] grid-cols-2 gap-3 max-sm:items-start sm:grid-cols-2 lg:grid-cols-3">
      {TILES.map(({ icon: Icon, title, body }, i) => {
        const banner = i === 0
        const visual = i === 3
        return (
          <div
            key={title}
            className={`flex min-w-0 flex-col rounded-[10px] bg-[#181816] p-4 sm:block sm:p-5 ${PHONE[i] ?? ''} ${
              banner ? 'max-sm:flex-row max-sm:items-start max-sm:gap-4' : ''
            }`}
          >
            {visual && <LoopVisual />}
            <span
              className={`grid shrink-0 place-items-center rounded-full bg-[#0c0c0b] ${
                banner ? 'size-14 sm:size-16' : 'size-11 sm:size-16'
              } ${visual ? 'max-sm:hidden' : ''}`}
            >
              <Icon size={20} strokeWidth={1.6} aria-hidden />
            </span>
            <div className="min-w-0">
              <h3
                className={`text-[15px] font-semibold max-sm:leading-[1.25] sm:mt-[34px] sm:text-[16px] ${
                  banner ? 'max-sm:mt-0.5' : 'mt-5'
                }`}
              >
                {title}
              </h3>
              <p
                className={`mt-2 leading-[1.35] whitespace-pre-line text-[#dcdcdc] sm:mt-2.5 sm:text-[16px] sm:leading-[1.3] ${
                  banner ? 'text-[15px]' : 'text-[13.5px]'
                }`}
              >
                {body}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The phone-only picture on the "Watch full seats" tile: the tile's own bell
 * on a dashed loop, the check that runs again and again until a seat opens.
 * Static, like every other tile. Hidden from `sm` up, where the tile is its
 * ordinary self.
 */
function LoopVisual() {
  return (
    <div className="relative mb-1 grid aspect-square w-full place-items-center rounded-[8px] bg-[#0c0c0b] sm:hidden" aria-hidden>
      <svg viewBox="0 0 120 120" className="size-[82%] text-white/25">
        <path
          d="M60 22c22 0 34 12 34 26s-14 22-34 22-34 10-34 24 12 18 34 18 34-8 34-22-12-22-34-24-34-12-34-26 12-18 34-18z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="4 5"
          strokeLinecap="round"
        />
      </svg>
      <BellRing size={26} strokeWidth={1.6} className="absolute top-[14%] left-[50%] -translate-x-1/2 text-white" />
    </div>
  )
}
