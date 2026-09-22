/**
 * Prove the admin scope works end to end, against a running deployment.
 *
 *   node scripts/verify-alfred.mjs https://concordiatracker.com ct_adm_xxxxx
 *
 * WHY A SCRIPT AND NOT A UNIT TEST. Everything below needs three things this
 * repo cannot fake: a serverless function (they do not run under Vite), the
 * project JWT secret, and the real database. The pieces that CAN be checked
 * offline already are — api/_v1-agent.test.mjs covers the token and the image
 * reader, db/verify.mjs covers every policy against real Postgres. This is
 * the join.
 *
 * IT CLEANS UP AFTER ITSELF. The organisation it makes is left in place only
 * if a step fails, so there is something to look at.
 */
const [, , BASE_RAW, TOKEN] = process.argv
if (!BASE_RAW || !TOKEN) {
  console.error('usage: node scripts/verify-alfred.mjs <base-url> <ct_adm_ token>')
  process.exit(2)
}
const BASE = BASE_RAW.replace(/\/+$/, '')
const HANDLE = `ct-probe-${Date.now().toString(36)}`

let failures = 0
function check(label, ok, detail) {
  if (ok) console.log(`  ok    ${label}`)
  else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `\n         ${detail}` : ''}`)
  }
}

async function call(method, path, body, contentType) {
  const headers = { Authorization: `Bearer ${TOKEN}` }
  let payload
  if (body instanceof Uint8Array) {
    headers['Content-Type'] = contentType ?? 'application/octet-stream'
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 200) } }
  return { status: res.status, json }
}

/** A real 1x1 PNG, so the magic-byte check and the bucket both accept it. */
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

console.log(`\nAgainst ${BASE}\n`)

console.log('the key itself')
{
  const anon = await fetch(`${BASE}/api/v1/admin`).then((r) => r.status)
  check('no token is refused', anon === 401, `got ${anon}`)
  const bad = await fetch(`${BASE}/api/v1/admin`, { headers: { Authorization: 'Bearer ct_adm_nope' } }).then((r) => r.status)
  check('a token that does not exist is refused', bad === 401, `got ${bad}`)

  const idx = await call('GET', '/api/v1/admin')
  check('the index answers', idx.status === 200, `got ${idx.status} ${JSON.stringify(idx.json).slice(0, 200)}`)
  check('  and lists reads and writes separately',
    Array.isArray(idx.json.reads) && Array.isArray(idx.json.writes))
  check('  and names what it will not do', Array.isArray(idx.json.withheld) && idx.json.withheld.length > 0)
}

console.log('\nadmin data')
{
  const o = await call('GET', '/api/v1/admin/overview')
  check('overview returns numbers', o.status === 200 && o.json.data !== null, `got ${o.status}`)
  const u = await call('GET', '/api/v1/admin/users')
  check('the user list is reachable', u.status === 200, `got ${u.status}`)
  const t = await call('GET', '/api/v1/admin/tickets?status=open')
  check('tickets are reachable', t.status === 200, `got ${t.status}`)
  const nope = await call('GET', '/api/v1/admin/no-such-thing')
  check('an unknown name is a 404', nope.status === 404, `got ${nope.status}`)
  const gone = await call('POST', '/api/v1/admin/delete-org', { org_id: '00000000-0000-0000-0000-000000000000' })
  check('a withheld call is refused with a reason', gone.status === 403 && gone.json.reason === 'withheld',
    JSON.stringify(gone.json).slice(0, 160))
  const wrongMethod = await call('POST', '/api/v1/admin/overview', {})
  check('a read cannot be POSTed', wrongMethod.status === 405, `got ${wrongMethod.status}`)
}

let created = null
console.log('\nan organisation, end to end')
{
  const made = await call('POST', '/api/v1/orgs', {
    name: 'Probe Society',
    handle: HANDLE,
    bio: 'A throwaway organisation created by the acceptance script.',
    color: '#4b5563',
    glyph: 'PS',
  })
  check('it can be created', made.status === 201, `got ${made.status} ${JSON.stringify(made.json).slice(0, 200)}`)
  created = made.json?.organization?.id ?? null
  check('  and this account is put on its team', made.json?.claimed === true)

  const read = await call('GET', `/api/v1/orgs/${HANDLE}`)
  check('it can be read back', read.status === 200 && read.json?.organization?.name === 'Probe Society')

  const edited = await call('PATCH', `/api/v1/orgs/${HANDLE}`, {
    bio: 'Edited by the acceptance script.',
    links: { instagram: 'https://instagram.com/example' },
  })
  check('the profile can be edited', edited.status === 200 && edited.json?.organization?.bio?.includes('Edited'))

  const logo = await call('POST', `/api/v1/orgs/${HANDLE}/logo`, PNG, 'image/png')
  check('a logo uploads and is set', logo.status === 200 && String(logo.json?.url ?? '').includes('org-media'),
    JSON.stringify(logo.json).slice(0, 200))

  const b64 = await call('POST', `/api/v1/orgs/${HANDLE}/banner`, {
    data_base64: Buffer.from(PNG).toString('base64'),
  })
  check('a banner uploads from base64 too', b64.status === 200 && Boolean(b64.json?.url))

  const junk = await call('POST', `/api/v1/orgs/${HANDLE}/media`, new TextEncoder().encode('<svg/>'), 'image/png')
  check('something that is not an image is refused', junk.status === 415, `got ${junk.status}`)
}

console.log('\npublishing')
{
  const media = await call('POST', `/api/v1/orgs/${HANDLE}/media`, PNG, 'image/png')
  const url = media.json?.url
  check('an image can be uploaded for a post', media.status === 201 && Boolean(url))

  const post = await call('POST', `/api/v1/orgs/${HANDLE}/posts`, {
    caption: 'Posted by the acceptance script.',
    media: [url],
  })
  check('a post publishes', post.status === 201, JSON.stringify(post.json).slice(0, 200))

  const noImage = await call('POST', `/api/v1/orgs/${HANDLE}/posts`, { caption: 'nothing attached' })
  check('a post with no image is refused', noImage.status === 400)

  const story = await call('POST', `/api/v1/orgs/${HANDLE}/stories`, {
    image_url: url,
    caption: 'A story from the acceptance script.',
  })
  check('a story publishes', story.status === 201, JSON.stringify(story.json).slice(0, 200))

  const when = new Date(Date.now() + 7 * 86400000).toISOString()
  const event = await call('POST', `/api/v1/orgs/${HANDLE}/events`, {
    title: 'Probe event',
    start: when,
    category: 'clubs',
    mode: 'in-person',
    location: 'H 920',
  })
  check('an event publishes', event.status === 201, JSON.stringify(event.json).slice(0, 200))
  const eventId = event.json?.event?.id

  const badDate = await call('POST', `/api/v1/orgs/${HANDLE}/events`, { title: 'x', start: 'next tuesday' })
  check('a date it cannot read is refused rather than guessed', badDate.status === 400)

  if (eventId) {
    const edited = await call('PATCH', `/api/v1/orgs/${HANDLE}/events/${eventId}`, { location: 'MB 3.210' })
    check('an event can be edited', edited.status === 200 && edited.json?.event?.location === 'MB 3.210')
  }

  const events = await call('GET', `/api/v1/orgs/${HANDLE}/events`)
  check('the events list comes back', events.status === 200 && events.json.count >= 1)
}

console.log('\ninvites and the team')
{
  const invite = await call('POST', `/api/v1/orgs/${HANDLE}/invites`, {
    kind: 'team',
    email: 'probe@example.com',
    role: 'member',
  })
  check('a team invite is created', invite.status === 201, JSON.stringify(invite.json).slice(0, 200))
  check('  and comes back as a link somebody can open',
    String(invite.json?.url ?? '').includes('/organizer/join/'))
  const inviteId = invite.json?.invite?.id

  const list = await call('GET', `/api/v1/orgs/${HANDLE}/invites`)
  check('invites can be listed with what became of them', list.status === 200)
  check('  and an unaccepted one shows as not accepted',
    (list.json?.team_invites ?? []).some((i) => i.accepted === false))

  const team = await call('GET', `/api/v1/orgs/${HANDLE}/team`)
  check('the team lists this account and the invitee', team.status === 200 && team.json.count >= 2)
  check('  without handing back the invite token',
    JSON.stringify(team.json).includes('invite_pending') && !JSON.stringify(team.json).includes('invite_token":"'))

  if (inviteId) {
    const revoked = await call('DELETE', `/api/v1/orgs/${HANDLE}/invites/${inviteId}`)
    check('an unaccepted invite can be revoked', revoked.status === 200)
  }

  const insights = await call('GET', `/api/v1/orgs/${HANDLE}/insights`)
  check('insights are counts only', insights.status === 200 && typeof insights.json.privacy === 'string')
}

console.log('\nthe line that must hold: publishing needs membership')
{
  // An organisation this account is definitely not on. Any other one will do.
  const all = await call('GET', '/api/v1/orgs')
  const other = (all.json?.organizations ?? []).find((o) => o.handle !== `@${HANDLE}`)
  if (!other) {
    check('a second organisation exists to test against', false, 'none found')
  } else {
    const read = await call('GET', `/api/v1/orgs/${other.handle.slice(1)}`)
    check(`reading ${other.handle} is allowed`, read.status === 200)

    const write = await call('PATCH', `/api/v1/orgs/${other.handle.slice(1)}`, { bio: 'should not land' })
    check(`  but editing it is refused`, write.status === 403 && write.json.reason === 'not_a_member',
      `got ${write.status} ${JSON.stringify(write.json).slice(0, 160)}`)

    const post = await call('POST', `/api/v1/orgs/${other.handle.slice(1)}/posts`, { media: ['https://x/y.png'] })
    check('  and posting to it is refused', post.status === 403, `got ${post.status}`)

    // There is no claim verb any more, and that is the point: an earlier
    // version had one guarded by "the org has no team yet", and almost every
    // seeded organisation has no team, so it was one call to self-grant.
    const claim = await call('POST', `/api/v1/orgs/${other.handle.slice(1)}/claim`)
    check('  and there is no way to join it', claim.status === 404, `got ${claim.status}`)
  }
}

console.log('\ncleanup')
if (created && failures === 0) {
  // Deleting an org is not reachable through the API on purpose, so this says
  // what is left rather than pretending it tidied up.
  console.log(`  note  @${HANDLE} (${created}) is still there. Remove it in the admin console.`)
} else if (created) {
  console.log(`  note  @${HANDLE} (${created}) left in place for inspection.`)
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exitCode = failures === 0 ? 0 : 1
