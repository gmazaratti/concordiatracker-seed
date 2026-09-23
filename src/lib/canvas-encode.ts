/**
 * Encode a canvas to an image the `org-media` bucket accepts, and say which.
 *
 * WHY THIS EXISTS: iOS Safari cannot encode WebP from a canvas.
 * `toBlob(cb, 'image/webp')` does not fail there — it silently hands back a
 * PNG. The upload guard then refused it with "That photo was not prepared
 * correctly", which is what every iPhone post hit; and the org-image path
 * uploaded that PNG LABELLED as WebP. So: ask for WebP, look at what came
 * back, and fall back to a format the browser really produced — JPEG for a
 * photo (a phone-sized PNG can pass the 4 MB bucket limit), PNG where
 * transparency matters (a logo). The result is still pixels our own canvas
 * drew, which is the security property; only the container differs.
 */
export type EncodedType = 'image/webp' | 'image/jpeg' | 'image/png'

export const EXT: Record<EncodedType, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  quality = 0.9,
  fallback: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<Blob> {
  const webp = await toBlob(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp') return webp
  const other = await toBlob(canvas, fallback, quality)
  if (other && (other.type === 'image/jpeg' || other.type === 'image/png')) return other
  throw new Error('This browser could not prepare the photo. Try another browser.')
}

export function isEncodedType(t: string): t is EncodedType {
  return t === 'image/webp' || t === 'image/jpeg' || t === 'image/png'
}
