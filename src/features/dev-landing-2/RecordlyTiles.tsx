import { FileUser, Heart, MessageCircleMore, Mic, MonitorPlay, MousePointer2, type LucideIcon } from 'lucide-react'

type Tile = { icon: LucideIcon; title: string; body: string }

const TILES: Tile[] = [
  { icon: Mic, title: 'Record microphone & system audio', body: 'Dual-source audio capture with sample-accurate sync. Speak, demo, and showcase with flawless sound.' },
  { icon: FileUser, title: 'Save and load projects', body: 'Recordly remembers your workspace. Save projects with all your audio, video, and layout choices, then reopen them instantly to continue creating.' },
  { icon: MonitorPlay, title: 'Change export format and quality', body: 'Turn your recording into a smooth MP4 or a looping GIF.\nPerfect for demos, tutorials, and quick social posts.' },
  { icon: MousePointer2, title: 'Loop cursor path', body: 'Loop your cursor path so GIFs and autoplay clips stay engaging. No jumps, no stutters; just clean, continuous motion.' },
  { icon: MessageCircleMore, title: 'Import audio tracks & webcam footage', body: 'Import audio files and webcam video with full timeline control. Layer, sync, and refine external media right inside your project.' },
  { icon: Heart, title: 'Free & open-source', body: 'Recordly is fully free and open-source, with no paywalls or hidden limits. Transparent, community-driven, and built for creators who value control.' },
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
    <div className="mx-auto mt-14 grid w-full max-w-[1080px] grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
 * The phone-only picture on the "Loop cursor path" tile: the tile's own cursor
 * icon sitting on the closed, looping path it describes. Static, like every
 * other tile. Hidden from `sm` up, where the tile is its ordinary self.
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
      <MousePointer2
        size={26}
        strokeWidth={1.6}
        className="absolute top-[16%] left-[53%] fill-white text-white"
      />
    </div>
  )
}
