/**
 * node src/lib/attribution.test.mjs
 *
 * Two things matter: the channel a signup is filed under, and that nothing
 * personal reaches the stored record (no query strings, no full referrer, no
 * invite token in the landing path).
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.attribution.test.tmp.mjs')
execSync(
  `npx esbuild --bundle "${path.join(here, 'attribution.ts')}" --format=esm "--alias:@=./src" --outfile="${out}"`,
  { stdio: 'pipe', cwd: path.join(here, '..', '..') },
)
const { channelFor, firstTouchFrom } = await import(pathToFileURL(out).href)

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}
const NOW = new Date('2026-09-26T12:00:00Z')
const SITE = 'https://concordiatracker.com'
const touch = (href, ref = '') => firstTouchFrom(SITE + href, ref, NOW)
const ch = (t, sourceRef = null, referralCode = null) => channelFor({ touch: t, sourceRef, referralCode })

// What is stored
const t1 = touch('/?utm_source=instagram&utm_medium=story&utm_campaign=fall-launch&email=a@b.c', 'https://l.instagram.com/?u=https%3A%2F%2Fx&e=secret')
check('utm tags kept', t1.utm_source === 'instagram' && t1.utm_medium === 'story' && t1.utm_campaign === 'fall-launch')
check('unknown query params dropped', !JSON.stringify(t1).includes('a@b.c'))
check('referrer reduced to its host', t1.referrer_host === 'l.instagram.com' && !JSON.stringify(t1).includes('secret'))
check('landing path has no query', t1.landing_path === '/')
check('utm values capped at 40', touch('/?utm_campaign=' + 'x'.repeat(90)).utm_campaign.length === 40)
const inv = touch('/join/c76199deb7c341a9bde7cfa87ccc8cb8d2367645')
check('invite token stripped from landing path', inv.landing_path === '/join/:token', inv.landing_path)
check('own site is not a referrer', touch('/app', SITE + '/pricing').referrer_host === undefined)
check('www. removed from referrer', touch('/', 'https://www.google.com/').referrer_host === 'google.com')
check('malformed referrer ignored', touch('/', 'not a url').referrer_host === undefined)

// Channels
check('invite landing beats everything', ch(inv, 'reddit', 'ALEX') === 'invite')
check('utm instagram', ch(t1) === 'instagram')
check('utm linkedin', ch(touch('/?utm_source=linkedin')) === 'linkedin')
check('utm qr code is in person', ch(touch('/?utm_source=flyer&utm_medium=qr')) === 'in_person')
check('utm email', ch(touch('/?utm_source=newsletter')) === 'email')
check('other utm is a campaign', ch(touch('/?utm_source=csu-bulletin')) === 'campaign')
check('source link (/r) when no utm', ch(touch('/r'), 'reddit') === 'reddit')
check('source link beats a referral code', ch(touch('/ig'), 'instagram', 'ALEX') === 'instagram')
check('referral code', ch(touch('/?ref=ALEX'), null, 'ALEX') === 'referral')
check('google is search', ch(touch('/', 'https://www.google.ca/')) === 'search')
check('chatgpt is an AI assistant', ch(touch('/', 'https://chatgpt.com/')) === 'ai_assistant')
check('reddit referrer', ch(touch('/', 'https://old.reddit.com/r/Concordia')) === 'reddit')
check('concordia.ca referrer', ch(touch('/', 'https://www.concordia.ca/students.html')) === 'concordia')
check('t.co is social', ch(touch('/', 'https://t.co/abc')) === 'social')
check('unknown site is a referral site', ch(touch('/', 'https://someblog.example/')) === 'referral_site')
check('nothing at all is direct', ch(touch('/')) === 'direct')
check('no first touch is unknown', ch(null) === 'unknown')
check('a malformed source ref is ignored', ch(touch('/'), 'Bad Ref!') === 'direct')

console.log(failures ? `\n${failures} failed` : '\nall attribution checks passed')
process.exit(failures ? 1 : 0)
