/**
 * Chat colours, per conversation.
 *
 * A Semester-pass feature, on the same line every other bit of personalisation
 * draws: the app is readable and complete without it, and making it yours is
 * the upgrade. Nothing here changes what a message SAYS.
 *
 * Chosen per conversation rather than globally because that is what people
 * actually do with it — a different colour for the friend you plan group
 * projects with is a way of knowing which thread you are in before you read a
 * word. The choice is yours alone; the other person sees their own.
 *
 * Fixed hex, not theme tokens, so a thread keeps its identity across light,
 * dark and a custom theme — the same rule the course colours follow.
 */
export interface ChatTheme {
  id: string
  label: string
  /** The conversation's backdrop. */
  bg: string
  /** Your own bubbles. Theirs stay on the neutral surface so the two are never
   *  confusable, however loud a colour you pick. */
  bubble: string
  /** Text on `bubble` — measured once here rather than computed per render. */
  bubbleText: string
}

export const CHAT_THEMES: ChatTheme[] = [
  { id: 'default', label: 'Default', bg: '', bubble: '', bubbleText: '' },
  { id: 'ocean', label: 'Ocean', bg: '#0d1b2a', bubble: '#2b7bbd', bubbleText: '#ffffff' },
  { id: 'forest', label: 'Forest', bg: '#0e1a14', bubble: '#2f8f5b', bubbleText: '#ffffff' },
  { id: 'plum', label: 'Plum', bg: '#170e1c', bubble: '#8a4fb0', bubbleText: '#ffffff' },
  { id: 'ember', label: 'Ember', bg: '#1c0f0c', bubble: '#c65a3c', bubbleText: '#ffffff' },
  { id: 'rose', label: 'Rose', bg: '#1c0f14', bubble: '#cf5470', bubbleText: '#ffffff' },
  { id: 'slate', label: 'Slate', bg: '#12151a', bubble: '#4c6079', bubbleText: '#ffffff' },
  { id: 'sand', label: 'Sand', bg: '#1a170f', bubble: '#b0873a', bubbleText: '#1a1408' },
  { id: 'mint', label: 'Mint', bg: '#0d1a18', bubble: '#2aa38f', bubbleText: '#04211c' },
]

export function chatTheme(id: string | undefined): ChatTheme {
  return CHAT_THEMES.find((t) => t.id === id) ?? CHAT_THEMES[0]
}
