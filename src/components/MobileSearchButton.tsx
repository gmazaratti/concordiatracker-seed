import { Search } from 'lucide-react'
import { useCommandPalette } from '@/app/providers/command-palette'
import { useT } from '@/i18n/i18n'

/**
 * The search field in the mobile top bar.
 *
 * It looks like an input and behaves like a button, which is deliberate: the
 * palette already IS a search field, with typeahead and results, and putting a
 * second real input in the header would mean two places to type and a decision
 * about which one wins. So this is the affordance — a field-shaped target that
 * expands into the palette sheet when tapped.
 *
 * It takes the space between the mark and the avatar, which is why the logo
 * drops its wordmark on mobile: "ConcordiaTracker" spelled out plus a search
 * field plus an avatar does not fit 375px, and of the three the wordmark is the
 * one nobody needs to read twice.
 */
export function MobileSearchButton() {
  const { openPalette } = useCommandPalette()
  const t = useT()
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label={t('nav.search')}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-left text-[13px] text-subtle transition-colors duration-150 active:bg-surface-2"
    >
      <Search size={15} aria-hidden className="shrink-0" />
      <span className="truncate">{t('nav.search')}</span>
    </button>
  )
}
