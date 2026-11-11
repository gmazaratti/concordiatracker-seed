import type { Block } from '@/data/guides'
import type { PhotoKey } from '@/data/resource-photos'

/** One entry of a guide's "On this page" list. */
export interface TocEntry {
  id: string
  label: string
  /** 1 = a section heading, 2 = a titled point inside a section. */
  level: 1 | 2
}

/** The element id a body block's heading gets (block index, then point index). */
export const tocId = (block: number, point?: number) => `g-${block}${point === undefined ? '' : `-${point}`}`

/**
 * The outline of a guide: its section headings, plus the titled points inside
 * a section, so a guide written as a run of points (the "mistakes" one) still
 * has something to jump to.
 */
export function tocOf(body: Block[]): TocEntry[] {
  const out: TocEntry[] = []
  body.forEach((b, i) => {
    if ('h' in b) out.push({ id: tocId(i), label: b.h, level: 1 })
    else if ('steps' in b) b.steps.forEach((s, j) => out.push({ id: tocId(i, j), label: s.t, level: 2 }))
  })
  return out
}

/** The photograph and one line that introduce each part of the directory. */
export const GROUP_ART: Record<string, { photo: PhotoKey; blurb: string }> = {
  advising: { photo: 'tower', blurb: 'The people who confirm you are taking the right courses in the right order.' },
  records: { photo: 'hall', blurb: 'Registration, fees, account blocks and the dates that decide refunds.' },
  learning: { photo: 'study', blurb: 'Tutoring, writing help, the library and what comes after the degree.' },
  health: { photo: 'quad', blurb: 'The clinic, counselling and accommodations. All included in your fees.' },
  money: { photo: 'molson', blurb: 'Loans, bursaries, scholarships and advising for international students.' },
  help: { photo: 'ev', blurb: 'Independent and confidential help when something has gone wrong.' },
  new: { photo: 'plaza', blurb: 'Orientation, student life and getting between the two campuses.' },
}

/** The photograph behind each "I need" tile. */
export const NEED_PHOTO: Record<string, PhotoKey> = {
  advisor: 'tower',
  fees: 'hall',
  writing: 'stacks',
  tutoring: 'study',
  mind: 'quad',
  access: 'sky',
  money: 'molson',
  dispute: 'ev',
  shuttle: 'loyola',
  jobs: 'plaza',
}
