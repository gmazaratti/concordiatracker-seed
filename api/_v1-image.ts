/**
 * Reading an uploaded image, without trusting what the caller said it was.
 *
 * PURE ON PURPOSE. No imports, so Node can run the test file directly. The
 * repo has learned this twice: a helper trapped beside a network module
 * cannot be tested without a bundler step, and the bundler step is where the
 * tests quietly stop being run.
 *
 * WHAT THIS CAN AND CANNOT DO. The browser re-encodes every upload through a
 * canvas, which destroys a polyglot payload outright. A serverless function
 * cannot re-encode, so the defence here is narrower and worth stating: the
 * first bytes must match one of three raster formats, the content type we
 * store is the one derived HERE rather than the one the caller claimed, and
 * the bucket rejects anything outside that list on its own.
 */

/** The bucket's own ceiling. Stated in the error rather than discovered. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export interface ImageKind {
  type: string
  ext: string
}

/** The format, read from the bytes. Null means we will not store it. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length < 12) return null
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { type: 'image/png', ext: 'png' }
  }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { type: 'image/jpeg', ext: 'jpg' }
  }
  const ascii = (from: number, to: number): string =>
    String.fromCharCode(...Array.from(b.slice(from, to)))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { type: 'image/webp', ext: 'webp' }
  }
  return null
}

/**
 * Bytes out of a request body, however the caller found it easiest to send.
 *
 * Raw is the honest way and keeps a 4 MB image under the platform's 4.5 MB
 * body ceiling. Base64 inside JSON inflates by a third, which an agent will
 * reach for anyway because it is what a tool call can express, so it is
 * accepted and the limit is checked afterwards either way.
 */
export function imageBytes(raw: ArrayBuffer, contentType: string): Uint8Array | { error: string } {
  const buf = new Uint8Array(raw)
  if (contentType !== 'application/json') return buf

  let text = ''
  try {
    text = new TextDecoder().decode(buf)
  } catch {
    return { error: 'That body could not be read as text.' }
  }
  let body: { data_base64?: unknown; image_base64?: unknown }
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    return { error: 'That JSON body could not be read.' }
  }
  const field = body.data_base64 ?? body.image_base64
  if (typeof field !== 'string' || field.trim() === '') {
    return { error: 'Send the image as raw bytes, or as JSON with a "data_base64" field.' }
  }
  // A browser-style data URL is the other thing an agent reasonably sends.
  const b64 = field.replace(/^data:[^,]*,/, '').replace(/\s+/g, '')
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return { error: 'That "data_base64" value is not valid base64.' }
  }
}

/** The whole check in one call: decode, size, format. */
export function readImage(
  raw: ArrayBuffer,
  contentType: string,
): { bytes: Uint8Array; kind: ImageKind } | { error: string; status: number } {
  const bytes = imageBytes(raw, contentType)
  if ('error' in bytes) return { error: bytes.error, status: 400 }
  if (bytes.length === 0) return { error: 'The request body was empty.', status: 400 }
  if (bytes.length > MAX_IMAGE_BYTES) {
    return {
      error: `That image is ${(bytes.length / 1048576).toFixed(1)} MB. The limit is 4 MB.`,
      status: 413,
    }
  }
  const kind = sniffImage(bytes)
  if (!kind) {
    return {
      error: 'That is not a PNG, JPEG or WebP. Those are the three the image bucket accepts.',
      status: 415,
    }
  }
  return { bytes, kind }
}
