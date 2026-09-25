import type { Key } from '@/i18n/en'

/**
 * The FAQ's structure: topics in the order a newcomer meets them, each a list
 * of question ids. The words live in the i18n files (`faqPage.q.<id>` and
 * `faqPage.a.<id>`), so this file only decides what goes where.
 *
 * Every answer has to be true of the live product, the rule the docs and the
 * homepage FAQ follow. When a feature changes, the answer changes with it.
 */
export interface FaqGroup {
  id: string
  title: Key
  items: string[]
}

export const FAQ_GROUPS: FaqGroup[] = [
  { id: 'start', title: 'faqPage.g.start', items: ['what', 'affiliated', 'install', 'start', 'french'] },
  {
    id: 'courses',
    title: 'faqPage.g.courses',
    items: ['add', 'scan', 'blueprints', 'badges', 'moved', 'tasks'],
  },
  { id: 'grades', title: 'faqPage.g.grades', items: ['scale', 'needed', 'current', 'projection', 'record'] },
  { id: 'moodle', title: 'faqPage.g.moodle', items: ['moodle', 'moodleSafe', 'external', 'econ', 'academic'] },
  { id: 'planning', title: 'faqPage.g.planning', items: ['seats', 'schedule'] },
  { id: 'community', title: 'faqPage.g.community', items: ['communityWhat', 'clubsSee', 'messages'] },
  {
    id: 'billing',
    title: 'faqPage.g.billing',
    items: ['free', 'price', 'trial', 'cancel', 'refund', 'stop', 'card'],
  },
  { id: 'privacy', title: 'faqPage.g.privacy', items: ['grades', 'profile', 'sell', 'delete', 'age'] },
  { id: 'clubs', title: 'faqPage.g.clubs', items: ['listed', 'clubPublish', 'team'] },
  {
    id: 'teachers',
    title: 'faqPage.g.teachers',
    items: ['teacherPortal', 'teacherGrades', 'teacherAccess', 'adopt'],
  },
]

export const qKey = (id: string) => `faqPage.q.${id}` as Key
export const aKey = (id: string) => `faqPage.a.${id}` as Key

/** `[label](href)` inside an answer, the only markup answers carry. */
export const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g

/** An answer as plain text, links reduced to their label (for structured data). */
export const plainAnswer = (text: string) => text.replace(LINK_RE, '$1')
