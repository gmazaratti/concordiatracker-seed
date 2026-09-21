import type { StoryOverlay } from '@/lib/social-posts'

/**
 * The look of text dragged onto a story — one table, read by the composer AND
 * the viewer.
 *
 * THIS FILE IS PURE AND HAS NO REACT IN IT on purpose. The composer has to
 * draw exactly what the viewer will draw, or a club positions a caption over
 * someone's face and it lands somewhere else for everyone who watches. Two
 * copies of these classes would drift on the first tweak.
 */

export interface FontOption {
  id: StoryOverlay['font']
  label: string
  /** Tailwind classes. Weight and tracking are part of the face here: a story
   *  caption is display type, and the difference between the four options is
   *  only legible if each one commits. */
  className: string
}

export const STORY_FONTS: FontOption[] = [
  { id: 'modern', label: 'Modern', className: 'font-display font-semibold tracking-tight' },
  { id: 'classic', label: 'Classic', className: 'font-semibold' },
  { id: 'signature', label: 'Signature', className: 'font-display italic font-medium' },
  { id: 'typewriter', label: 'Typewriter', className: 'font-mono font-medium tracking-tight' },
]

export function fontClass(id: StoryOverlay['font']): string {
  return (STORY_FONTS.find((f) => f.id === id) ?? STORY_FONTS[0]).className
}

export interface AnimOption {
  id: StoryOverlay['anim']
  label: string
  /** A keyframe from index.css, or '' for none. */
  className: string
}

/**
 * Four, and no more. Every one runs ONCE and settles at the element's resting
 * position, so the global reduced-motion block (which zeroes durations) leaves
 * the caption exactly where it belongs rather than mid-flight or invisible.
 */
export const STORY_ANIMS: AnimOption[] = [
  { id: 'none', label: 'None', className: '' },
  { id: 'rise', label: 'Rise', className: 'ct-story-rise' },
  { id: 'fade', label: 'Fade', className: 'ct-story-fade' },
  { id: 'pop', label: 'Pop', className: 'ct-story-pop' },
]

export function animClass(id: StoryOverlay['anim']): string {
  return (STORY_ANIMS.find((a) => a.id === id) ?? STORY_ANIMS[0]).className
}

/**
 * The palette. Fixed hexes, NOT theme tokens: a story is an image somebody
 * else will look at under their own theme, and a caption that turns sage on
 * one device and gold on another is not the thing that was published.
 */
export const STORY_COLORS = [
  '#ffffff',
  '#000000',
  '#ff3b5c',
  '#ffb02e',
  '#ffe14d',
  '#5ad46a',
  '#3ab7f0',
  '#7b61ff',
  '#ff7ac6',
]

export const DEFAULT_OVERLAY: StoryOverlay = {
  text: '',
  x: 0.5,
  y: 0.32,
  font: 'modern',
  color: '#ffffff',
  chip: true,
  anim: 'none',
}

/** Handles typed into a caption, so a club can tag by writing rather than by
 *  opening a picker. Matches the app's own handle shape (see HANDLE_RE). */
export function mentionsIn(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/@([a-z0-9_.]{3,30})/gi)) out.add(m[1].toLowerCase())
  return [...out]
}

/** How long a story has left, in the words a story uses. */
export function storyAge(createdAt: string, now: number): string {
  const mins = Math.max(0, Math.round((now - new Date(createdAt).getTime()) / 60_000))
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}
