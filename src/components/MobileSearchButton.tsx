import { Search } from 'lucide-react'
import { useCommandPalette } from '@/app/providers/command-palette'
import { useT } from '@/i18n/i18n'

/**
 * Search, in the mobile top bar. An icon, nothing more.
 *
 * It was briefly a full-width field, and that was wrong: it pushed the wordmark
 * out of the header and made the top of the app look like a different product.
 * The palette it opens IS the search field — this only has to be the door, and
 * a magnifying glass is the most universally understood door there is.
 */
export function MobileSearchButton() {
  const { openPalette } = useCommandPalette()
  const t = useT()
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label={t('nav.search')}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors duration-150 active:bg-surface-2"
    >
      <Search size={19} aria-hidden />
    </button>
  )
}
