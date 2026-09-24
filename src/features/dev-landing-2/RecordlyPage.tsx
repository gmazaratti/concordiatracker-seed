import { FileUser, Heart, MessageCircleMore, Mic, MonitorPlay, MousePointer2, Plus } from 'lucide-react'
import { useNoIndex } from '@/features/dev-landing/useNoIndex'
import { RecordlyHeader } from './RecordlyHeader'
import { StackedCards } from './StackedCards'
import { AppleMark, CodeRabbitMark, LinuxMark, WindowsMark } from './glyphs'

const TILES = [
  { icon: Mic, title: 'Record microphone & system audio', body: 'Dual-source audio capture with sample-accurate sync. Speak, demo, and showcase with flawless sound.' },
  { icon: FileUser, title: 'Save and load projects', body: 'Recordly remembers your workspace. Save projects with all your audio, video, and layout choices, then reopen them instantly to continue creating.' },
  { icon: MonitorPlay, title: 'Change export format and quality', body: 'Turn your recording into a smooth MP4 or a looping GIF.\nPerfect for demos, tutorials, and quick social posts.' },
  { icon: MousePointer2, title: 'Loop cursor path', body: 'Loop your cursor path so GIFs and autoplay clips stay engaging. No jumps, no stutters; just clean, continuous motion.' },
  { icon: MessageCircleMore, title: 'Import audio tracks & webcam footage', body: 'Import audio files and webcam video with full timeline control. Layer, sync, and refine external media right inside your project.' },
  { icon: Heart, title: 'Free & open-source', body: 'Recordly is fully free and open-source, with no paywalls or hidden limits. Transparent, community-driven, and built for creators who value control.' },
]

/**
 * `/dev/landing/2`: a 1:1 layout and motion comp of recordly.dev, built from
 * the owner's screen recording and screenshots, so the structure can be
 * perfected before ConcordiaTracker's own content goes in. Hidden, noindex,
 * linked from nowhere.
 *
 * THE HERO, which is the point: the product card is `position: sticky` 75px
 * from the top (just under the fixed 76px header). Everything after it lives
 * in ONE solid-background layer with a higher z-index, starting right at the
 * card's bottom edge, so once the card pins, that layer slides up over it from
 * below. The card itself never scales, fades or moves once pinned. The layer is
 * solid for the whole rest of the page, so the pinned card stays hidden under
 * it to the end.
 */
export function RecordlyPage() {
  useNoIndex()

  return (
    <div id="top" className="min-h-[100dvh] overflow-x-clip bg-[#0b0b0b] font-sans text-white antialiased">
      <RecordlyHeader />

      <main>
        <section className="mx-auto max-w-[1160px] px-4 pt-[112px] text-center md:pt-[126px]">
          <h1 className="text-[38px] leading-[1.05] font-bold tracking-[-0.05em] md:text-[62px]">
            Make beautiful screen recordings
          </h1>
          <p className="mx-auto mt-5 max-w-[1130px] text-[17px] leading-[1.3] text-[#9b9b9b] md:mt-[26px] md:text-[19px]">
            Recordly is your open-source tool for demos, walkthroughs, and product videos. Includes built-in auto-zooms,
            smooth cursor, and much more.
          </p>
          <a
            href="#top"
            className="mt-6 inline-flex h-[52px] items-center gap-3 rounded-[6px] bg-[#0b63f6] px-6 text-[19px] font-semibold text-white transition-colors hover:bg-[#1b6ff8] md:mt-[26px]"
          >
            <LinuxMark className="size-[20px]" />
            Download for Linux
          </a>
          <div className="mt-[18px] flex items-center justify-center gap-5 text-[#9a9a9a]">
            <WindowsMark className="size-[20px]" />
            <AppleMark className="size-[21px]" />
            <LinuxMark className="size-[21px]" />
          </div>
        </section>

        {/* The pinned card. */}
        <div className="sticky top-[75px] z-0 mx-auto mt-[60px] w-[calc(100%-32px)] max-w-[960px] md:mt-[80px]">
          <div className="aspect-[16/10] overflow-hidden rounded-[16px] shadow-[0_0_60px_rgba(70,130,255,0.18)] md:rounded-[24px]">
            <video
              src="/dev-landing-2/hero.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className="size-full object-cover"
            />
          </div>
        </div>

        {/* Everything else: one solid layer that covers the pinned card. */}
        <div className="relative z-10 bg-[#0b0b0b] px-4 pt-[80px] pb-40 md:pt-[117px]">
          <div className="text-center">
            <p className="text-[18px] text-[#8b8b8b] md:text-[20px]">Backed by the community</p>
            <p className="mt-2 flex items-center justify-center gap-2.5 text-[26px] font-bold tracking-[-0.03em] text-[#9b9b9b] md:text-[30px]">
              <CodeRabbitMark className="size-[30px]" />
              CodeRabbit
            </p>
          </div>

          <div className="mt-[90px] md:mt-[110px]">
            <StackedCards />
          </div>

          <div className="mx-auto mt-14 grid w-full max-w-[1080px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TILES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-[10px] bg-[#181816] p-5">
                <span className="grid size-16 place-items-center rounded-full bg-[#0c0c0b]">
                  <Icon size={20} strokeWidth={1.6} aria-hidden />
                </span>
                <h3 className="mt-[34px] text-[16px] font-semibold">{title}</h3>
                <p className="mt-2.5 text-[16px] leading-[1.3] whitespace-pre-line text-[#dcdcdc]">{body}</p>
              </div>
            ))}
          </div>

          <section className="mx-auto mt-40 grid w-full max-w-[1080px] gap-8 md:grid-cols-[1fr_520px]">
            <div>
              <p className="text-[14px] text-[#8b8b8b]">// FAQ</p>
              <h2 className="mt-2 text-[34px] leading-[1.1] tracking-[-0.04em] md:text-[40px]">
                Questions? <span className="text-[#8b8b8b]">We&apos;ve got answers</span>
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              <details className="group rounded-[10px] bg-[#181816] px-4">
                <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                  Is Recordly really free?
                  <Plus size={18} className="transition-transform duration-200 group-open:rotate-45" aria-hidden />
                </summary>
                <p className="pb-4 text-[15px] leading-[1.4] text-[#b4b4b4]">
                  Recordly is fully free and open-source, with no paywalls or hidden limits.
                </p>
              </details>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
