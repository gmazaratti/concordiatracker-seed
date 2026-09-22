/**
 * The two halves of the agent path that can be checked without a network:
 * what an uploaded image is allowed to be, and what the minted token says.
 *
 *   node api/_v1-agent.test.mjs
 *
 * The JWT half matters more than it looks. Everything else about this feature
 * is enforced by policies that db/verify.mjs exercises against real Postgres,
 * and those policies hang on ONE claim inside this token. If the claim is
 * spelled wrong, or the signature is malformed, or the expiry is long, none
 * of the database checks would notice — the token would simply be refused, or
 * worse, accepted with the admin bypass intact.
 */
import { createHmac } from 'node:crypto'
import { imageBytes, readImage, sniffImage, MAX_IMAGE_BYTES } from './_v1-image.ts'

let failures = 0
function check(label, ok, detail) {
  if (ok) {
    console.log(`  ok    ${label}`)
  } else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `\n         ${detail}` : ''}`)
  }
}

const buf = (...bytes) => new Uint8Array(bytes)
const pad = (head, len = 16) => {
  const out = new Uint8Array(len)
  out.set(head)
  return out
}
const ab = (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)

console.log('\nimage: what we agree to store')
{
  check('a PNG is recognised', sniffImage(pad(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)))?.type === 'image/png')
  check('a JPEG is recognised', sniffImage(pad(buf(0xff, 0xd8, 0xff, 0xe0)))?.type === 'image/jpeg')

  const webp = new Uint8Array(16)
  webp.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
  webp.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8)
  check('a WebP is recognised', sniffImage(webp)?.type === 'image/webp')

  // The three that matter: the format is read from the bytes, so a caller
  // cannot store something else by labelling it.
  check('an SVG is refused however it is labelled', sniffImage(pad(buf(0x3c, 0x73, 0x76, 0x67))) === null)
  check('a PDF is refused', sniffImage(pad(buf(0x25, 0x50, 0x44, 0x46))) === null)
  check('a RIFF container that is not WebP is refused', sniffImage(pad(buf(0x52, 0x49, 0x46, 0x46))) === null)
  check('something too short to identify is refused', sniffImage(buf(0x89, 0x50)) === null)
}

console.log('\nimage: getting the bytes out of a request')
{
  const png = pad(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
  const raw = imageBytes(ab(png), 'image/png')
  check('raw bytes pass through untouched', !('error' in raw) && raw.length === 16 && raw[0] === 0x89)

  const b64 = Buffer.from(png).toString('base64')
  const json = new TextEncoder().encode(JSON.stringify({ data_base64: b64 }))
  const decoded = imageBytes(ab(json), 'application/json')
  check('base64 in JSON decodes to the same bytes',
    !('error' in decoded) && Buffer.from(decoded).equals(Buffer.from(png)))

  const dataUrl = new TextEncoder().encode(JSON.stringify({ data_base64: `data:image/png;base64,${b64}` }))
  const fromUrl = imageBytes(ab(dataUrl), 'application/json')
  check('a data: URL prefix is stripped rather than corrupting the image',
    !('error' in fromUrl) && Buffer.from(fromUrl).equals(Buffer.from(png)))

  const empty = imageBytes(ab(new TextEncoder().encode('{}')), 'application/json')
  check('JSON with no image says which field is missing',
    'error' in empty && empty.error.includes('data_base64'))

  const broken = imageBytes(ab(new TextEncoder().encode('not json')), 'application/json')
  check('a body that is not JSON says so', 'error' in broken && broken.error.includes('JSON'))
}

console.log('\nimage: the whole check')
{
  const png = pad(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
  const good = readImage(ab(png), 'image/png')
  check('a small PNG is accepted', !('error' in good) && good.kind.ext === 'png')

  const empty = readImage(new ArrayBuffer(0), 'image/png')
  check('an empty body is a 400', 'error' in empty && empty.status === 400)

  const svg = readImage(ab(pad(buf(0x3c, 0x73, 0x76, 0x67))), 'image/png')
  check('the wrong format is a 415, not a 400', 'error' in svg && svg.status === 415)

  const big = new Uint8Array(MAX_IMAGE_BYTES + 1)
  big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const over = readImage(ab(big), 'image/png')
  check('over 4 MB is a 413', 'error' in over && over.status === 413)
  check('  and the message says how big it was', 'error' in over && over.error.includes('4.0 MB'))
}

console.log('\nthe minted token')
{
  process.env.SUPABASE_JWT_SECRET = 'test-secret-not-a-real-one'
  const { mintActorJwt, JwtUnavailable } = await import('./_v1-jwt.ts')

  const uid = '11111111-2222-3333-4444-555555555555'
  const token = mintActorJwt(uid, 'agent@example.com')
  const [h, p, sig] = token.split('.')
  const j = (seg) => JSON.parse(Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())

  check('it is a three-part JWT', Boolean(h && p && sig))
  check('signed HS256, which is what this project verifies with', j(h).alg === 'HS256')

  const expect = createHmac('sha256', 'test-secret-not-a-real-one')
    .update(`${h}.${p}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  check('the signature verifies against the secret', sig === expect)

  const claims = j(p)
  check('sub is the account, which is what auth.uid() reads', claims.sub === uid)
  check('role is authenticated, which is what PostgREST switches on', claims.role === 'authenticated')
  check('aud is authenticated', claims.aud === 'authenticated')
  check('the email rides along, for the org helpers that match on it', claims.email === 'agent@example.com')

  // The whole narrowing hangs on this one claim being present and true.
  check('ct_agent is present and true', claims.ct_agent === true)

  const life = claims.exp - claims.iat
  check('it lives 60 seconds, not an hour', life === 60, `got ${life}`)
  check('nbf is a second early, so a slow clock does not refuse it', claims.iat - claims.nbf === 1)

  // A second account must not be able to reuse the first one's token.
  const other = mintActorJwt('99999999-9999-9999-9999-999999999999', null)
  check('a different account gets a different token', other !== token)
  check('  and no email claim when there is none', j(other.split('.')[1]).email === undefined)

  delete process.env.SUPABASE_JWT_SECRET
  let threw = null
  try {
    mintActorJwt(uid, null)
  } catch (e) {
    threw = e
  }
  check('with no secret it refuses rather than signing with nothing', threw instanceof JwtUnavailable)
  check('  and the message names the variable', String(threw?.message).includes('SUPABASE_JWT_SECRET'))
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
// exitCode rather than process.exit(): the dynamic import above leaves the
// module loader mid-teardown, and exiting hard from inside it aborts on
// Windows with a libuv assertion and a 127 that looks like a failing test.
process.exitCode = failures === 0 ? 0 : 1
