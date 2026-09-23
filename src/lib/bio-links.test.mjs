/**
 * Bio links. Pure text in, nodes out — which is the whole reason it is here
 * and not in a component: what becomes a link is a safety decision, and a
 * safety decision that can only be checked by looking at a screen is one
 * nobody checks.
 */
import { hasLink, insertLink, normaliseHref, parseBio } from './bio-links.ts'

let failed = 0
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok    ${name}`)
  else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const links = (s) => parseBio(s).filter((n) => n.kind === 'link')
const text = (s) =>
  parseBio(s)
    .map((n) => n.text)
    .join('')

console.log('\nPlain text')
check('nothing in, nothing out', parseBio('').length === 0)
check('a bio with no links is one text node', parseBio('hello there').length === 1)
check('newlines survive', text('a\n\nb') === 'a\n\nb')

console.log('\nExplicit links')
const one = parseBio('see [our Linktree](https://linktr.ee/x) for more')
check('label becomes the text', links('[a](https://b.com)')[0]?.text === 'a')
check('url becomes the href', links('[a](https://b.com)')[0]?.href === 'https://b.com/')
check('the surrounding words are kept', one[0]?.text === 'see ' && one[2]?.text === ' for more')
check('two links in one line', links('[a](https://a.com) and [b](https://b.com)').length === 2)

console.log('\nBare urls')
check('a pasted url is linked', links('go to https://example.com now').length === 1)
check(
  'and shows without the protocol',
  links('https://example.com/x')[0]?.text === 'example.com/x',
)
check(
  'a full stop after it is sentence punctuation',
  links('see https://example.com.')[0]?.href === 'https://example.com/',
)
check('and the full stop is kept in the text', text('see https://example.com.').endsWith('.'))
check('a bare domain is NOT linked', links('visit example.com').length === 0)

console.log('\nOnly http(s) — the whole point')
check('javascript: is refused', links('[tap](javascript:alert(1))').length === 0)
check(
  'and is shown as what it is, not swallowed',
  text('[tap](javascript:alert(1))').includes('javascript:'),
)
check('data: is refused', links('[x](data:text/html,<script>)').length === 0)
check('a bare javascript: url is refused', links('javascript:alert(1)').length === 0)
check('vbscript: is refused', links('[x](vbscript:msgbox)').length === 0)

console.log('\nAwkward input')
// Not zero links: the markup fails, but a URL is still a URL and linking it
// is what somebody who typed that meant. What must NOT happen is the label
// being used, which would mean half-parsed markup reached the screen.
{
  const l = links('[a](https://b.com')
  check('an unclosed bracket falls back to the bare url', l.length === 1 && l[0].text === 'b.com')
  check('and the brackets stay as characters', text('[a](https://b.com').startsWith('[a]('))
}
check('empty parens are text', links('[a]()').length === 0)
{
  const l = links('[a\nb](https://c.com)')
  check('a label with a newline is not a label', l.length === 1 && l[0].text === 'c.com')
}
check('hasLink agrees with parse', hasLink('x https://a.com') && !hasLink('nothing here'))

console.log('\nInserting')
{
  const r = insertLink('see our page', 8, 12, 'https://a.com')
  check('wraps the selection', r.value === 'see our [page](https://a.com)', r.value)
  check('caret lands after the markup', r.caret === r.value.length)
}
{
  const r = insertLink('abc', 1, 1, 'https://a.com')
  check('an empty selection gets a placeholder label', r.value === 'a[link](https://a.com)bc', r.value)
}

console.log('\nNormalising what people type')
check('a bare domain gets https', normaliseHref('linktr.ee/x') === 'https://linktr.ee/x')
check('an http url is left alone', normaliseHref('http://a.com/') === 'http://a.com/')
check('whitespace is trimmed', normaliseHref('  https://a.com  ') === 'https://a.com/')
check('javascript: is refused', normaliseHref('javascript:alert(1)') === null)
check('empty is refused', normaliseHref('   ') === null)

console.log(failed === 0 ? '\nbio-links: all checks passed' : `\nbio-links: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
