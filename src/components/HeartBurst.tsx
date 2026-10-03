import { Heart } from 'lucide-react'
import type { HeartBurstItem } from '@/lib/heart-bursts'

/**
 * Draws the double-tap hearts (lib/heart-bursts). Place it inside the
 * `relative` element whose coordinates the bursts were measured in. It never
 * takes a click: `pointer-events-none`, so a third tap still reaches the
 * photo underneath.
 */
export function HeartBursts({ bursts }: { bursts: HeartBurstItem[] }) {
  return (
    <>
      {bursts.map((h) => (
        <span
          key={h.id}
          aria-hidden
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: h.x, top: h.y }}
        >
          <span className="ct-heart-burst block">
            <Heart
              size={96}
              strokeWidth={h.on ? 0 : 1.75}
              className={h.on ? 'fill-white text-white' : 'text-white'}
              style={{ filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.35))' }}
            />
          </span>
        </span>
      ))}
    </>
  )
}
