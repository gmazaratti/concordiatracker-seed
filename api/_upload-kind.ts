/**
 * What was uploaded, decided by the file's own bytes (never the Content-Type
 * the client chose to send), and how to read it.
 *
 *   pdf    the model reads it natively (as before)
 *   image  a photo or screenshot of the outline: the model reads it natively
 *   docx   a Word file: we unzip it and pull the text out ourselves
 *   text   plain text (.txt / .md), passed through as text
 *
 * The old binary .doc format is NOT read: it is a different, undocumented-in-
 * practice container, and the honest answer is "save it as .docx or PDF".
 *
 * No dependencies: a .docx is a zip, and Node already ships the one piece of a
 * zip reader that is hard (raw DEFLATE). The rest is reading a directory.
 */
import { inflateRawSync } from 'node:zlib'

export type UploadKind =
  | { kind: 'pdf'; mime: 'application/pdf'; ext: 'pdf' }
  | { kind: 'image'; mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' }
  | { kind: 'docx'; mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; ext: 'docx' }
  | { kind: 'text'; mime: 'text/plain'; ext: 'txt' }

export type Sniffed = UploadKind | { kind: 'unsupported'; why: string }

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const

const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v)

export function sniffUpload(b: Uint8Array): Sniffed {
  if (starts(b, [0x25, 0x50, 0x44, 0x46])) return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf' } // %PDF
  if (starts(b, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' }
  if (starts(b, [0x89, 0x50, 0x4e, 0x47])) return { kind: 'image', mime: 'image/png', ext: 'png' }
  if (starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { kind: 'image', mime: 'image/webp', ext: 'webp' }
  }
  if (starts(b, [0x50, 0x4b, 0x03, 0x04])) {
    // A zip: a Word document only if it has the Word body inside.
    return zipEntries(b).some((e) => e.name === 'word/document.xml')
      ? { kind: 'docx', mime: DOCX_MIME, ext: 'docx' }
      : { kind: 'unsupported', why: 'That zip file is not a Word document.' }
  }
  if (starts(b, [0xd0, 0xcf, 0x11, 0xe0])) {
    return { kind: 'unsupported', why: 'That is an old Word .doc file. Save it as .docx or PDF and upload that.' }
  }
  // HEIC/HEIF (iPhone photos): ftyp box at byte 4.
  if (starts(b, [0x66, 0x74, 0x79, 0x70], 4)) {
    return { kind: 'unsupported', why: 'That photo format (HEIC) is not supported. Take a screenshot or export it as JPG.' }
  }
  if (looksLikeText(b)) return { kind: 'text', mime: 'text/plain', ext: 'txt' }
  return { kind: 'unsupported', why: 'Upload the outline as a PDF, a Word file (.docx), or a photo.' }
}

/** Mostly printable UTF-8 with no NUL bytes: plain text. */
function looksLikeText(b: Uint8Array): boolean {
  const n = Math.min(b.length, 4000)
  if (n === 0) return false
  let printable = 0
  for (let i = 0; i < n; i++) {
    const c = b[i]
    if (c === 0) return false
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)) printable++
  }
  return printable / n > 0.95
}

// ── Zip ─────────────────────────────────────────────────────────────────────

interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  localOffset: number
}

/** The central directory, read from the End Of Central Directory record. */
function zipEntries(b: Uint8Array): ZipEntry[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  // EOCD is in the last 22 + 65535 bytes (its comment can be up to 64KB).
  let eocd = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return []
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const out: ZipEntry[] = []
  const dec = new TextDecoder()
  for (let k = 0; k < count && p + 46 <= b.length; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true)
    const compressedSize = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const localOffset = dv.getUint32(p + 42, true)
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen))
    out.push({ name, method, compressedSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

function readEntry(b: Uint8Array, e: ZipEntry): Uint8Array | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const p = e.localOffset
  if (dv.getUint32(p, true) !== 0x04034b50) return null
  const start = p + 30 + dv.getUint16(p + 26, true) + dv.getUint16(p + 28, true)
  const data = b.subarray(start, start + e.compressedSize)
  if (e.method === 0) return data
  if (e.method === 8) return new Uint8Array(inflateRawSync(data))
  return null
}

// ── Word → text ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

/**
 * The visible text of a .docx, with paragraphs on their own lines and table
 * cells separated by " | ". Tables matter: grade breakdowns are usually one.
 * Headers and footers are left out: they repeat on every page and carry
 * nothing a grade scheme needs.
 */
export function docxText(b: Uint8Array): string {
  const entry = zipEntries(b).find((e) => e.name === 'word/document.xml')
  if (!entry) return ''
  const raw = readEntry(b, entry)
  if (!raw) return ''
  const xml = new TextDecoder().decode(raw)
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:(br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
        return Number.isFinite(n) ? String.fromCodePoint(n) : m
      }
      return ENTITIES[code.toLowerCase()] ?? m
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
