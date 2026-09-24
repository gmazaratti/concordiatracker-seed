import { Plus } from 'lucide-react'
import { RecordlyMark } from './glyphs'

/**
 * Recordly's FAQ and footer, text taken from recordly.dev's served HTML.
 *
 * The four questions are theirs. Only the first has an answer here: the rest of
 * their answers are not in the served page (they load later), and this comp
 * does not invent copy, so those rows show the question without opening.
 */
const QUESTIONS: { q: string; a?: string }[] = [
  { q: 'Is Recordly really free?', a: 'Recordly is fully free and open-source, with no paywalls or hidden limits.' },
  { q: 'Can I use Recordly for commercial purposes?' },
  { q: 'What platforms does Recordly support?' },
  { q: 'How can I help Recordly?' },
]

const row = 'flex items-center justify-between gap-4 py-4 text-left text-[16px] font-semibold'

export function RecordlyFaq() {
  return (
    <section id="faq" className="mx-auto mt-40 grid w-full max-w-[1080px] gap-8 md:grid-cols-[1fr_520px]">
      <div className="min-w-0">
        <p className="text-[14px] text-[#8b8b8b]">// FAQ</p>
        <h2 className="mt-2 text-[34px] leading-[1.1] tracking-[-0.04em] md:text-[40px]">
          Questions? <span className="text-[#8b8b8b]">We&apos;ve got answers.</span>
        </h2>
        <p className="mt-4 text-[16px] text-[#8b8b8b]">For support, please open an issue on GitHub.</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {QUESTIONS.map(({ q, a }) =>
          a ? (
            <details key={q} className="group rounded-[10px] bg-[#181816] px-4">
              <summary className={`${row} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                {q}
                <Plus size={18} className="shrink-0 transition-transform duration-200 group-open:rotate-45" aria-hidden />
              </summary>
              <p className="pb-4 text-[15px] leading-[1.4] text-[#b4b4b4]">{a}</p>
            </details>
          ) : (
            <div key={q} className={`${row} rounded-[10px] bg-[#181816] px-4`}>
              {q}
              <Plus size={18} className="shrink-0" aria-hidden />
            </div>
          ),
        )}
      </div>
    </section>
  )
}

export function RecordlyFooter() {
  return (
    <footer className="mx-auto mt-40 flex w-full max-w-[1080px] flex-col gap-10 border-t border-white/10 pt-12 sm:flex-row sm:justify-between">
      <div className="min-w-0 max-w-[340px]">
        <a href="#top" className="flex items-center gap-2 text-[20px] font-semibold tracking-[-0.03em] text-white">
          <RecordlyMark className="size-[26px]" />
          Recordly
        </a>
        <p className="mt-3 text-[15px] leading-[1.4] text-[#8b8b8b]">
          The open-source software for beautiful screen recordings.
        </p>
      </div>
      <nav aria-label="Footer" className="min-w-0">
        <p className="text-[14px] font-semibold text-white">Navigation</p>
        <ul className="mt-3 flex flex-col gap-2 text-[15px] text-[#8b8b8b]">
          <li>
            <a href="#top" className="transition-colors hover:text-white">
              Features
            </a>
          </li>
          <li>
            <a href="#faq" className="transition-colors hover:text-white">
              FAQ
            </a>
          </li>
        </ul>
      </nav>
    </footer>
  )
}
