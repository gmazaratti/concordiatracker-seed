/** The outreach link shape, in a plain module.
 *
 *  Split out because a .tsx that exports a component AND a function loses
 *  fast refresh (`react-refresh/only-export-components`) — the same split
 *  `SOCIAL_FIELDS` and the Moodle constants needed. It lives in ONE place so
 *  the code inside the URL and the code in the table cannot drift apart. */
export function outreachUrl(l: { code: string; target: string }): string {
  const site = typeof window === 'undefined' ? '' : window.location.origin
  return `${site}${l.target}?utm_source=outreach&utm_medium=link&utm_campaign=${encodeURIComponent(l.code)}`
}
