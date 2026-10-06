import type { Note } from './types'

/**
 * Notes already opened this session, so switching back to one is instant and
 * an edit made a second ago is never replaced by an older server copy. Its own
 * module so the page can drop an entry (after restoring a version) without the
 * editor file exporting anything but components.
 */
export const opened = new Map<string, Note>()
