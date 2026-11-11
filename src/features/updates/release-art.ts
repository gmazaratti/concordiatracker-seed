import {
  Bell,
  BookOpen,
  CalendarDays,
  Compass,
  CreditCard,
  GraduationCap,
  LayoutGrid,
  MessagesSquare,
  NotebookPen,
  Palette,
  Radar,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { PhotoKey } from '@/data/resource-photos'
import type { Release } from '@/data/releases'

/**
 * The cover for a release card: a campus photo, a colour laid over it, and a
 * glyph. Chosen by hand for the recent releases; older ones rotate through the
 * same set by their position, so every card has a cover and neighbours differ.
 */
export interface ReleaseArt {
  photo: PhotoKey
  hex: string
  icon: LucideIcon
}

const BY_VERSION: Record<string, ReleaseArt> = {
  '2.4.0': { photo: 'plaza', hex: '#3f8f6b', icon: Compass },
  '2.3.0': { photo: 'molson', hex: '#b4483f', icon: ShieldCheck },
  '2.2.0': { photo: 'study', hex: '#3d6fb8', icon: NotebookPen },
  '2.1.0': { photo: 'sky', hex: '#8a5bc4', icon: Bell },
  '2.0.0': { photo: 'hall', hex: '#2f8f8a', icon: Rocket },
  '1.32.0': { photo: 'ev', hex: '#c0703a', icon: MessagesSquare },
  '1.31.0': { photo: 'quad', hex: '#b8497c', icon: Users },
  '1.30.0': { photo: 'stacks', hex: '#3d6fb8', icon: CalendarDays },
  '1.29.0': { photo: 'tower', hex: '#4b8f4a', icon: RefreshCw },
  '1.28.0': { photo: 'loyola', hex: '#c98a2b', icon: RefreshCw },
  '1.27.0': { photo: 'plaza', hex: '#5a62c9', icon: LayoutGrid },
  '1.26.0': { photo: 'sky', hex: '#b8497c', icon: Palette },
  '1.25.0': { photo: 'hall', hex: '#3f8f6b', icon: GraduationCap },
  '1.24.0': { photo: 'molson', hex: '#b4483f', icon: Radar },
  '1.23.0': { photo: 'study', hex: '#8a5bc4', icon: Compass },
  '1.22.0': { photo: 'ev', hex: '#2f8f8a', icon: CreditCard },
  '1.15.0': { photo: 'sky', hex: '#3d6fb8', icon: Smartphone },
}

const PHOTO_ROTA: PhotoKey[] = ['loyola', 'stacks', 'quad', 'ev', 'tower', 'hall', 'study', 'molson', 'plaza', 'sky']
const HEX_ROTA = ['#3d6fb8', '#3f8f6b', '#c0703a', '#8a5bc4', '#2f8f8a', '#b8497c', '#c98a2b']
const ICON_ROTA: LucideIcon[] = [Sparkles, BookOpen, CalendarDays, Users, Palette, GraduationCap]

export function artFor(release: Release, index: number): ReleaseArt {
  return (
    BY_VERSION[release.version] ?? {
      photo: PHOTO_ROTA[index % PHOTO_ROTA.length],
      hex: HEX_ROTA[index % HEX_ROTA.length],
      icon: ICON_ROTA[index % ICON_ROTA.length],
    }
  )
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

/** "2026-10-11" as "October 11, 2026", without a UTC shift. */
export function releaseDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return DATE_FMT.format(new Date(y, m - 1, day))
}

/** "6 new · 2 improved · 1 fixed", leaving out the kinds a release has none of. */
export function releaseCounts(release: Release): string {
  const n = (k: 'new' | 'improved' | 'fixed') => release.changes.filter((c) => c.kind === k).length
  return [
    n('new') && `${n('new')} new`,
    n('improved') && `${n('improved')} improved`,
    n('fixed') && `${n('fixed')} fixed`,
  ]
    .filter(Boolean)
    .join(' · ')
}
