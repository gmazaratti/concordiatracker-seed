import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Sparkles } from 'lucide-react'
import { ROLE_PRESETS, type OrgRoleDef, type RolePreset } from '@/lib/org-roles'
import { Button } from '@/components/ui/Button'
import { RoleGlyph } from '../RoleChip'

/**
 * "New role", with the jobs a student club actually has ready-made.
 *
 * Picking a preset FILLS THE EDITOR rather than creating the role, so the
 * permissions are on screen to read before anything is saved. A preset that
 * would sit at or above you is listed and disabled with the reason, and one
 * the club already has says so.
 */
export function NewRoleMenu({
  roles,
  mine,
  disabled,
  onBlank,
  onPreset,
}: {
  roles: OrgRoleDef[]
  mine: number
  disabled?: boolean
  onBlank: () => void
  onPreset: (p: RolePreset) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const have = new Set(roles.map((r) => r.name.trim().toLowerCase()))

  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const w = 300
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      const t = e.target as Node
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <>
      {/* Measured through a wrapper: Button does not forward a ref. */}
      <span ref={btn} className="inline-flex">
        <Button size="sm" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
          <Plus size={15} aria-hidden />
          New role
        </Button>
      </span>
      {open &&
        pos &&
        createPortal(
          <div
            ref={pop}
            role="menu"
            className="ct-animate-pop fixed z-[200] max-h-[min(30rem,calc(100dvh-6rem))] w-[300px] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-2xl"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onBlank()
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2"
            >
              <span className="grid size-8 place-items-center rounded-lg border border-dashed border-border-strong text-subtle">
                <Plus size={15} aria-hidden />
              </span>
              <span className="text-[13px] font-medium text-fg">Blank role</span>
            </button>
            <p className="mt-1 flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
              <Sparkles size={11} aria-hidden />
              Ready-made
            </p>
            {ROLE_PRESETS.map((p) => {
              const exists = have.has(p.name.toLowerCase())
              const tooHigh = p.position >= mine
              const off = exists || tooHigh
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitem"
                  disabled={off}
                  onClick={() => {
                    setOpen(false)
                    onPreset(p)
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <RoleGlyph role={p} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-[13px] font-medium text-fg">
                      {p.name}
                      {off && <span className="text-[10.5px] font-normal text-subtle">{exists ? 'Added' : 'Above you'}</span>}
                    </span>
                    <span className="block text-[11.5px] leading-snug text-subtle">{p.blurb}</span>
                  </span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
