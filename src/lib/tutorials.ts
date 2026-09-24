/**
 * Every in-app walkthrough, in one place.
 *
 * WRITTEN STEPS NOW, A VIDEO SLOT READY. Each entry can carry a `video` path
 * (drop the file in `public/tutorials/` and set it here) and the popover
 * plays it above the steps — nothing else has to change. Until then the steps
 * stand on their own, which is also what a screen reader and a slow
 * connection get anyway.
 *
 * The steps describe what somebody actually presses, in order, and nothing
 * the product cannot do.
 */
export interface Tutorial {
  title: string
  /** One line: what this gets you. */
  lede: string
  steps: string[]
  /** e.g. '/tutorials/map-link.mp4' — muted, looping, inline. */
  video?: string
  /** Shown while the video loads, and in its place under reduced motion. */
  poster?: string
}

export const TUTORIALS = {
  'map-link': {
    title: 'Getting the right map link',
    lede: 'A map link sends students straight to the room. Paste the SHARE link, not the address bar.',
    steps: [
      'Open Google Maps (or Apple Maps) and search the building, e.g. “Hall Building Concordia”.',
      'Tap the place so its card opens, then tap Share.',
      'Choose Copy link. Google gives a maps.app.goo.gl link; Apple gives maps.apple.com.',
      'Paste it here. A “map” tag under the field means we recognised it.',
    ],
  },
  'invite-accept': {
    title: 'What happens when you accept',
    lede: 'About two minutes from this screen to a live club page.',
    steps: [
      'Sign in or create an account. The club is tied to it.',
      'Tell us whether you are the president (if not, you invite them as a co-owner).',
      'Confirm the handle. It is the address every link to your club uses.',
      'Add a logo, banner and bio. The preview is exactly what students see.',
      'Optionally draft a first event and invite your team. Skip anything and come back later.',
    ],
    video: '/tutorials/org-onboarding.mp4',
    poster: '/tutorials/org-onboarding.jpg',
  },
  'first-post': {
    title: 'Publishing your first event',
    lede: 'Events are what students add to their calendars.',
    steps: [
      'Give it a title and a start time. Those two are required.',
      'Add a place (and a map link) or mark it online.',
      'Add a banner image if you have one: it also lets you share the event to the feed as a post.',
      'Save as a draft to keep it private, or Publish when it is ready.',
    ],
  },
  roles: {
    title: 'Roles and your team',
    lede: 'Everyone on the team has exactly one role; the role decides what they can do.',
    steps: [
      'Owner can do everything. Admin and Member are ready-made; create your own for execs.',
      'A role can only be handed out by someone ranked above it.',
      'Move a role up or down to change its rank.',
      'Invite someone from Team with a role already chosen, and they join with it.',
    ],
  },
  'first-story': {
    title: 'Posting a story',
    lede: 'A story is a picture with text on it that disappears on its own.',
    steps: [
      'Take a photo or pick one from your library.',
      'Tap Aa to add text; drag it where you want it.',
      'Add a caption, a mention, a place or a link if it helps.',
      'Tap the arrow, then choose how long it lasts: 24, 48 or 72 hours.',
    ],
  },
  activity: {
    title: 'The activity log',
    lede: 'Every change anybody makes to your club, and a way to put it back.',
    steps: [
      'Each row says who did what, and when. Tap a name to see that person.',
      'Undo reverts one change, and the undo is logged too.',
      '“Undo a run of changes” reverts everything one person did in a time window.',
    ],
  },
  'add-course': {
    title: 'Adding your first course',
    lede: 'Your deadlines come from your course outlines.',
    steps: [
      'Search the course code, e.g. COMP 248.',
      'If a verified outline exists, import it. The dates and weights come with it.',
      'No outline? Upload the syllabus PDF and we read the dates out of it.',
      'Or connect Moodle and your posted deadlines arrive on their own.',
    ],
  },
} satisfies Record<string, Tutorial>

export type TutorialId = keyof typeof TUTORIALS
