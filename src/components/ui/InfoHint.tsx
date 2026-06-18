import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

type Pos = { left: number; top: number; above: boolean }

/**
 * A small `(i)` help affordance — a button that opens a portaled popover with
 * free-form `children` (instructions, tips). Portaled + fixed so it never clips;
 * dismisses on outside-click / Escape. Used e.g. to explain image-host URLs.
 */
export function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const above = spaceBelow < 200 && r.top > spaceBelow
    const left = Math.min(r.left, window.innerWidth - 280)
    setPos({ left: Math.max(8, left), top: above ? r.top - 4 : r.bottom + 4, above })
  }, [])

  useEffect(() => {
    if (!open) return
    const reposition = () => place()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, place])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    place()
    setOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={toggle}
        className="inline-grid size-4 place-items-center rounded-full text-subtle transition-colors duration-150 hover:text-accent"
      >
        <Info size={13} aria-hidden />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={label}
            style={{
              position: 'fixed',
              left: pos.left,
              ...(pos.above ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            className="ct-animate-pop z-[60] w-[270px] rounded-xl border border-border bg-surface p-3 text-[12px] leading-relaxed text-muted shadow-2xl"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  )
}

/** The shared ImgBB how-to, reused by every image-URL field. */
export function ImgbbHint() {
  return (
    <InfoHint label="How to add an image">
      <p className="mb-1.5 font-medium text-fg">Hosting an image</p>
      <ol className="ml-3.5 list-decimal space-y-1">
        <li>
          Go to{' '}
          <a
            href="https://imgbb.com"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-accent hover:underline"
          >
            imgbb.com
          </a>{' '}
          and upload your image (free, no account needed).
        </li>
        <li>
          After it uploads, open the <span className="text-fg">“Embed codes”</span> dropdown and
          choose <span className="text-fg">“Direct link”</span>.
        </li>
        <li>
          Copy that link (it ends in <span className="font-mono text-fg">.png</span>/
          <span className="font-mono text-fg">.jpg</span>) and paste it here.
        </li>
      </ol>
      <p className="mt-1.5 text-subtle">The site loads your image straight from that URL.</p>
    </InfoHint>
  )
}
