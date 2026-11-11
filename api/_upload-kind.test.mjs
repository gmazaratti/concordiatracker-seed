/**
 * node api/_upload-kind.test.mjs
 *
 * What an upload is, from its bytes, and the Word reader. A Word file is built
 * here in memory (a real zip with a DEFLATE-compressed word/document.xml), so
 * the reader is checked against the same container Word writes.
 */
import { deflateRawSync } from 'node:zlib'
import { sniffUpload, docxText } from './_upload-kind.ts'

let fail = 0
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (!ok) fail++
}

/** A minimal zip holding the given files, DEFLATE-compressed. */
function zip(files) {
  const enc = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const nameB = enc.encode(name)
    const data = deflateRawSync(enc.encode(text))
    const local = new Uint8Array(30 + nameB.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, 8, true)
    lv.setUint32(18, data.length, true)
    lv.setUint16(26, nameB.length, true)
    local.set(nameB, 30)
    local.set(data, 30 + nameB.length)
    const central = new Uint8Array(46 + nameB.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, 8, true)
    cv.setUint32(20, data.length, true)
    cv.setUint16(28, nameB.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameB, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, centrals.length, true)
  ev.setUint16(10, centrals.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  const all = [...locals, ...centrals, eocd]
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of all) {
    out.set(p, at)
    at += p.length
  }
  return out
}

const xml =
  '<w:document><w:body>' +
  '<w:p><w:r><w:t>ENGL 244 A</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t xml:space="preserve">Mid-Term Essay &amp; notes</w:t><w:tab/><w:t>30%</w:t></w:r></w:p>' +
  '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Final</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>40%</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
  '</w:body></w:document>'
const docx = zip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': xml })

check('docx is recognised', sniffUpload(docx).kind === 'docx')
const text = docxText(docx)
check('paragraphs on their own lines', text.split('\n')[0] === 'ENGL 244 A')
check('entities decoded, tabs kept', text.includes('Mid-Term Essay & notes\t30%'))
check('table cells kept apart', /Final\s*\|\s*40%/.test(text))

check('a zip that is not Word is refused', sniffUpload(zip({ 'a.txt': 'hi' })).kind === 'unsupported')
check('pdf', sniffUpload(new TextEncoder().encode('%PDF-1.7\n...')).kind === 'pdf')
check('jpeg', sniffUpload(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])).kind === 'image')
check('png', sniffUpload(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])).kind === 'image')
check('webp', sniffUpload(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')).kind === 'image')
const doc = sniffUpload(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]))
check('old .doc is refused with a reason', doc.kind === 'unsupported' && /docx/i.test(doc.why))
const heic = sniffUpload(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]))
check('heic is refused with a reason', heic.kind === 'unsupported' && /HEIC/.test(heic.why))
check('plain text', sniffUpload(new TextEncoder().encode('ENGL 244\nMidterm 30% due Oct 7\n')).kind === 'text')
check('binary junk is refused', sniffUpload(new Uint8Array([1, 2, 0, 3, 4, 5])).kind === 'unsupported')

if (fail) process.exit(1)
