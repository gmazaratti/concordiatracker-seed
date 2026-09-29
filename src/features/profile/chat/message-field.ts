/**
 * Attributes for every message composer (DMs, club chats, support threads).
 *
 * Mobile Safari offered its AutoFill strip ("concordiatracker.com", the
 * saved-password key) above the keyboard on the message field, as if it were a
 * login. Its heuristics are private, so this is the reasonable set rather than
 * a guarantee: autocomplete off, a name that reads as a message and never as a
 * username, a plain text inputmode, and the password managers' own opt-out
 * attributes. Spell-check and auto-capitalisation stay on, because this is
 * prose. `enterKeyHint="send"` labels the return key for what it does.
 */
export const MESSAGE_FIELD = {
  name: 'ct-message-body',
  autoComplete: 'off',
  autoCorrect: 'on',
  autoCapitalize: 'sentences',
  spellCheck: true,
  inputMode: 'text',
  enterKeyHint: 'send',
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const
