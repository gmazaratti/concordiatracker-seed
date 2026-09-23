import { Play } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TEXT_SCALE, combine, cssFilter, presetAdjust, type PhotoText } from './photo-edit'
import type { ComposeItem } from './items'

/**
 * One photo in its frame, exactly as it will post.
 *
 * EVERY NUMBER HERE IS ONE `render-photo` ALSO USES. The crop is a cover crop
 * positioned by the same pan fractions (`object-position` and `coverRect` do
 * the same arithmetic), the filter string is generated from the same
 * adjustment the export applies as matrices, and text is sized as a fraction
 * of the frame's WIDTH in both — so a caption placed over somebody's face on a
 * phone lands on their face in the uploaded file.
 */
export function PhotoFrame({
  item,
  ratio,
  className,
  onTap,
  onTextPointerDown,
  activeText,
  showTextHint,
}: {
  item: ComposeItem
  ratio: number
  className?: string
  /** A tap on the photo, in fractions of the frame. */
  onTap?: (x: number, y: number) => void
  onTextPointerDown?: (e: React.PointerEvent, index: number) => void
  activeText?: number | null
  showTextHint?: boolean
}) {
  const filter = cssFilter(combine(presetAdjust(item.filter), item.slider))

  return (
    <div
      // Text is sized in container-width units: a fraction of THIS frame's
      // width, the same fraction `render-photo` multiplies the output width
      // by — with nothing to measure and no first frame without the text.
      className={cn('relative w-full overflow-hidden bg-black select-none [container-type:inline-size]', className)}
      style={{ aspectRatio: String(ratio) }}
      onClick={(e) => {
        if (!onTap || e.target !== e.currentTarget.querySelector('[data-photo]')) return
        const r = e.currentTarget.getBoundingClientRect()
        onTap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
      }}
    >
      {item.kind === 'video' ? (
        <>
          <video
            data-photo
            src={item.src}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
            style={{ objectPosition: `${item.panX * 100}% ${item.panY * 100}%` }}
          />
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-white/85">
            <Play size={28} className="fill-current" aria-hidden />
          </span>
        </>
      ) : (
        <img
          data-photo
          src={item.src}
          alt=""
          draggable={false}
          className="size-full object-cover"
          style={{
            objectPosition: `${item.panX * 100}% ${item.panY * 100}%`,
            filter: filter === 'none' ? undefined : filter,
          }}
        />
      )}

      {item.texts.map((t, i) => (
          <TextOverlay
            key={i}
            text={t}
            active={activeText === i}
            onPointerDown={onTextPointerDown ? (e) => onTextPointerDown(e, i) : undefined}
          />
        ))}

      {showTextHint && item.kind === 'image' && item.texts.length === 0 && (
        <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[13px] font-medium text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          Tap to add text
        </span>
      )}
    </div>
  )
}

function TextOverlay({
  text,
  active,
  onPointerDown,
}: {
  text: PhotoText
  active: boolean
  onPointerDown?: (e: React.PointerEvent) => void
}) {
  const cq = (f: number) => `${(TEXT_SCALE * 100 * f).toFixed(3)}cqw`
  return (
    <span
      onPointerDown={onPointerDown}
      className={cn(
        'absolute max-w-[82%] -translate-x-1/2 -translate-y-1/2 text-center break-words whitespace-pre-wrap',
        onPointerDown && 'cursor-move touch-none',
        active && 'outline-2 outline-offset-4 outline-white/80 outline-dashed',
      )}
      style={{
        left: `${text.x * 100}%`,
        top: `${text.y * 100}%`,
        color: text.color,
        fontSize: cq(1),
        lineHeight: 1.2,
        ...fontStyle(text.font),
        ...(text.chip
          ? {
              background: 'rgba(0,0,0,0.55)',
              padding: `${cq(0.28)} ${cq(0.45)}`,
              borderRadius: cq(0.3),
            }
          : { textShadow: `0 0 ${cq(0.25)} rgba(0,0,0,0.45)` }),
      }}
    >
      {text.text || ' '}
    </span>
  )
}

/** The same four faces `canvasFont` draws. */
function fontStyle(font: PhotoText['font']): React.CSSProperties {
  switch (font) {
    case 'classic':
      return { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 600 }
    case 'signature':
      return { fontFamily: '"Hanken Grotesk", Inter, sans-serif', fontWeight: 500, fontStyle: 'italic' }
    case 'typewriter':
      return { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontWeight: 500 }
    default:
      return { fontFamily: '"Hanken Grotesk", Inter, sans-serif', fontWeight: 700 }
  }
}
