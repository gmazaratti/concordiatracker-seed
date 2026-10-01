// npm run build:stm — rebuild public/data/stm-concordia.json from STM's GTFS.
//
// STM publishes its full static timetable as a ~43MB zip (CC BY 4.0, keyless):
//   https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip
// This script reads it ONCE and keeps only what the Today "Transit" widget
// needs: the bus and metro stops within walking distance of each campus, the
// times buses and trains stop there, and which days each timetable runs. The
// zip never reaches a client and nothing is parsed per request; the output is
// a static file served from the CDN.
//
// RE-RUN IT ROUGHLY EVERY TWO MONTHS. Each STM feed covers a fixed window
// (feed_info.txt: start/end). Past the end the widget says the timetable has
// expired instead of guessing. Usage:
//   node scripts/build-stm.mjs              (downloads the current feed)
//   node scripts/build-stm.mjs path/to.zip  (uses a local copy)
//
// No dependencies: the zip is read with node:zlib from its central directory,
// and stop_times.txt (~200MB unzipped) is streamed line by line.
import { createReadStream, openSync, readSync, closeSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createInflateRaw } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FEED = 'https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip'
const OUT = new URL('../public/data/stm-concordia.json', import.meta.url)
const CAMPUSES = {
  sgw: { lat: 45.4971, lon: -73.5788 },
  loy: { lat: 45.458, lon: -73.6398 },
}
/** Walking distance to a stop, in metres. Guy-Concordia metro is ~200m from
 *  the Hall Building; 300m catches it and the bus stops on both campuses. */
const RADIUS = 300

const metres = (aLat, aLon, bLat, bLon) => {
  const r = Math.PI / 180
  return 6371000 * Math.hypot((bLon - aLon) * r * Math.cos(((aLat + bLat) / 2) * r), (bLat - aLat) * r)
}

// ── A minimal zip reader ─────────────────────────────────────────────────────
function entries(path) {
  const fd = openSync(path, 'r')
  const size = statSync(path).size
  const tail = Buffer.alloc(Math.min(size, 66000))
  readSync(fd, tail, 0, tail.length, size - tail.length)
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) throw new Error('not a zip file')
  const count = tail.readUInt16LE(eocd + 10)
  const cdSize = tail.readUInt32LE(eocd + 12)
  const cdOffset = tail.readUInt32LE(eocd + 16)
  const cd = Buffer.alloc(cdSize)
  readSync(fd, cd, 0, cdSize, cdOffset)
  const out = {}
  for (let i = 0, p = 0; i < count; i++) {
    const method = cd.readUInt16LE(p + 10)
    const csize = cd.readUInt32LE(p + 20)
    const nameLen = cd.readUInt16LE(p + 28)
    const extraLen = cd.readUInt16LE(p + 30)
    const commentLen = cd.readUInt16LE(p + 32)
    const local = cd.readUInt32LE(p + 42)
    const name = cd.toString('utf8', p + 46, p + 46 + nameLen)
    const lh = Buffer.alloc(30)
    readSync(fd, lh, 0, 30, local)
    const start = local + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28)
    out[name] = { method, start, end: start + csize - 1 }
    p += 46 + nameLen + extraLen + commentLen
  }
  closeSync(fd)
  return out
}

async function* lines(path, entry) {
  const raw = createReadStream(path, { start: entry.start, end: entry.end })
  const stream = entry.method === 8 ? raw.pipe(createInflateRaw()) : raw
  yield* createInterface({ input: stream, crlfDelay: Infinity })
}

/** Rows as objects. GTFS fields here never contain quoted commas except
 *  names, so a small quote-aware split is enough. */
async function* rows(path, entry) {
  let header = null
  for await (const line of lines(path, entry)) {
    if (!line) continue
    const cells = []
    let cur = ''
    let q = false
    for (const ch of line.replace(/^﻿/, '')) {
      if (ch === '"') q = !q
      else if (ch === ',' && !q) {
        cells.push(cur)
        cur = ''
      } else cur += ch
    }
    cells.push(cur)
    if (!header) header = cells
    else yield Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))
  }
}

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// ── Build ────────────────────────────────────────────────────────────────────
let zip = process.argv[2]
if (!zip) {
  zip = join(tmpdir(), 'gtfs_stm.zip')
  console.log('downloading', FEED)
  const r = await fetch(FEED)
  if (!r.ok) throw new Error(`STM answered ${r.status}`)
  writeFileSync(zip, Buffer.from(await r.arrayBuffer()))
}
const z = entries(zip)

const feed = {}
for await (const r of rows(zip, z['feed_info.txt'])) Object.assign(feed, { start: r.feed_start_date, end: r.feed_end_date, version: r.feed_version })

const stops = {}
for await (const s of rows(zip, z['stops.txt'])) {
  if (s.location_type && s.location_type !== '0') continue
  const lat = Number(s.stop_lat)
  const lon = Number(s.stop_lon)
  for (const [campus, c] of Object.entries(CAMPUSES)) {
    const m = Math.round(metres(c.lat, c.lon, lat, lon))
    if (m <= RADIUS && (!stops[s.stop_id] || m < stops[s.stop_id].m)) {
      stops[s.stop_id] = { id: s.stop_id, name: s.stop_name, campus, m }
    }
  }
}
console.log('stops near campus:', Object.keys(stops).length)

const routes = {}
for await (const r of rows(zip, z['routes.txt'])) {
  routes[r.route_id] = { n: r.route_short_name, name: r.route_long_name, c: r.route_color || null, t: Number(r.route_type) }
}

const trips = new Map()
for await (const t of rows(zip, z['trips.txt'])) trips.set(t.trip_id, { r: t.route_id, s: t.service_id, h: t.trip_headsign })

// stop_times: keep visits to our stops; remember each trip's last stop so a
// bus that ENDS at campus (nobody boards it there) is not listed as departing.
const visits = []
const lastSeq = new Map()
let scanned = 0
for await (const st of rows(zip, z['stop_times.txt'])) {
  scanned++
  const seq = Number(st.stop_sequence)
  if ((lastSeq.get(st.trip_id) ?? -1) < seq) lastSeq.set(st.trip_id, seq)
  if (!stops[st.stop_id] || st.pickup_type === '1') continue
  visits.push({ trip: st.trip_id, stop: st.stop_id, seq, min: toMinutes(st.departure_time) })
}
console.log('stop_times scanned:', scanned, 'visits kept:', visits.length)

const lineKey = (stop, route, head) => `${stop}|${route}|${head}`
const lineMap = new Map()
const usedServices = new Set()
for (const v of visits) {
  if (v.seq === lastSeq.get(v.trip)) continue
  const t = trips.get(v.trip)
  if (!t) continue
  const k = lineKey(v.stop, t.r, t.h)
  const line = lineMap.get(k) ?? { stop: v.stop, route: t.r, headsign: t.h, svc: {} }
  ;(line.svc[t.s] ??= []).push(v.min)
  usedServices.add(t.s)
  lineMap.set(k, line)
}
for (const l of lineMap.values()) for (const s of Object.keys(l.svc)) l.svc[s] = [...new Set(l.svc[s])].sort((a, b) => a - b)

const services = {}
for await (const c of rows(zip, z['calendar.txt'])) {
  if (!usedServices.has(c.service_id)) continue
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((d) => c[d]).join('')
  services[c.service_id] = { days, start: c.start_date, end: c.end_date, add: [], remove: [] }
}
for await (const c of rows(zip, z['calendar_dates.txt'])) {
  if (!usedServices.has(c.service_id)) continue
  services[c.service_id] ??= { days: '0000000', start: c.date, end: c.date, add: [], remove: [] }
  services[c.service_id][c.exception_type === '1' ? 'add' : 'remove'].push(c.date)
}

const usedRoutes = new Set([...lineMap.values()].map((l) => l.route))
const out = {
  source: FEED,
  licence: 'CC BY 4.0, Société de transport de Montréal',
  builtAt: new Date().toISOString(),
  feed,
  stops: Object.values(stops).sort((a, b) => a.campus.localeCompare(b.campus) || a.m - b.m),
  routes: Object.fromEntries([...usedRoutes].map((r) => [r, routes[r]])),
  services,
  lines: [...lineMap.values()].sort((a, b) => a.stop.localeCompare(b.stop) || a.route.localeCompare(b.route, undefined, { numeric: true })),
}
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true })
const json = JSON.stringify(out)
writeFileSync(OUT, json)
console.log(`wrote ${OUT.pathname} (${(json.length / 1024).toFixed(1)} KB): ${out.stops.length} stops, ${out.lines.length} lines, ${usedRoutes.size} routes, feed ${feed.start}–${feed.end}`)
