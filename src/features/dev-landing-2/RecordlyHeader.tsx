import { GitHubMark, RecordlyMark } from './glyphs'

const LINKS = ['Discord', 'Twitter', 'Contact', 'Tip', 'Blog']

/** Recordly's header: logo left, five links centred, GitHub pill right.
 *  Fixed, solid black, so the pinned hero card slides up to sit just under it. */
export function RecordlyHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#0b0b0b]">
      <div className="mx-auto flex h-[76px] w-full max-w-[1112px] items-center justify-between px-4">
        <a href="#top" className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.03em] text-white">
          <RecordlyMark className="size-[26px]" />
          Recordly
        </a>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-4 md:flex">
          {LINKS.map((l) => (
            <a key={l} href="#top" className="text-[17px] text-white/90 transition-colors hover:text-white">
              {l}
            </a>
          ))}
        </nav>
        <a
          href="#top"
          className="flex h-11 items-center gap-2 rounded-[10px] bg-[#161616] px-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1e1e1e]"
        >
          <GitHubMark className="size-[17px]" />
          GitHub (31k)
        </a>
      </div>
    </header>
  )
}
