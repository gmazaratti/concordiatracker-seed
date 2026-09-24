/**
 * THE ONE PLACE TO PLUG IN DEMO VIDEOS.
 *
 * Record a clip (Recordly), export MP4 (H.264, no audio, ~1280px wide), drop
 * it and a poster frame into `public/demos/`, then set `src` + `poster` below.
 * Paths are served from the site root, so `public/demos/parse.mp4` is
 * `/demos/parse.mp4`.
 *
 * While `src` is empty the slot shows the live in-page demo for that feature,
 * with a small "Video slot: …" tag in the corner so it is obvious which slot is
 * still waiting on a file. Set `src` and the clip replaces the live demo.
 *
 * `aspect` is width / height of the recording. Match it to the file or the
 * frame will letterbox.
 */
export type DemoSlotId = 'syllabus' | 'grades' | 'calendar' | 'community'

export interface DemoSlot {
  id: DemoSlotId
  /** Shown on the placeholder so the owner knows which file goes where. */
  label: string
  src?: string
  poster?: string
  aspect: number
}

export const DEMO_SLOTS: Record<DemoSlotId, DemoSlot> = {
  syllabus: { id: 'syllabus', label: 'syllabus upload', src: '', poster: '', aspect: 16 / 10 },
  grades: { id: 'grades', label: 'grade-needed calculator', src: '', poster: '', aspect: 16 / 10 },
  calendar: { id: 'calendar', label: 'calendar and Moodle sync', src: '', poster: '', aspect: 16 / 10 },
  community: { id: 'community', label: 'community feed', src: '', poster: '', aspect: 16 / 10 },
}
