/** Festive mix — fixed hues so it pops the same in both themes. */
const COLORS = ['#8fb39a', '#e8b84b', '#e07a5f', '#6c8fd6', '#c98bdb', '#4fb0a5', '#f4a259']

interface Piece {
  i: number
  left: number
  delay: number
  duration: number
  drift: string
  spin: string
  size: number
  color: string
  round: boolean
}

// Generated ONCE at module load (not during render / not in an effect — keeps the
// component pure and lint-clean). A fixed particle layout per burst is
// imperceptible for confetti.
const PIECES: Piece[] = Array.from({ length: 120 }, (_, i) => ({
  i,
  left: Math.random() * 100,
  delay: Math.random() * 0.7,
  duration: 2.6 + Math.random() * 2,
  drift: `${(Math.random() * 2 - 1) * 16}vw`,
  spin: `${540 + Math.random() * 720}deg`,
  size: 6 + Math.random() * 6,
  color: COLORS[i % COLORS.length],
  round: Math.random() > 0.5,
}))

/**
 * A one-shot confetti burst — a fixed, pointer-events-none full-screen layer of
 * particles that fall + spin once and clear. Pure CSS animation (no library);
 * reduced-motion safe via the global duration-zero block (particles just start
 * off-screen → effectively no confetti).
 */
export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = count >= PIECES.length ? PIECES : PIECES.slice(0, count)
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.i}
          className="absolute top-0 block"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * (p.round ? 1 : 1.7),
              backgroundColor: p.color,
              borderRadius: p.round ? '9999px' : '1px',
              animation: `ct-confetti-fall ${p.duration}s cubic-bezier(0.3, 0.6, 0.4, 1) ${p.delay}s both`,
              '--ct-confetti-drift': p.drift,
              '--ct-confetti-spin': p.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
