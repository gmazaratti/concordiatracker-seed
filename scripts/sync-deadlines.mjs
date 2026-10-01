// npm run sync:deadlines — mirror the registrar's per-section deadlines now.
//
// The daily cron does this on its own (api/_sync-deadlines.ts, riding the
// Moodle job). This is for seeding a fresh database or checking a page change
// without waiting a day. Uses the same parser and writer as the cron.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { DEADLINES_PAGE, parseDeadlinesPage, writeDeadlines } from '../api/_deadlines-parse.ts'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const html = await (await fetch(DEADLINES_PAGE, { headers: { 'user-agent': 'ConcordiaTrackerBot/1.0 (+https://concordiatracker.com/about)' } })).text()
const rows = parseDeadlinesPage(html)
const result = await writeDeadlines(db, rows)
console.log(JSON.stringify(result, null, 2))
