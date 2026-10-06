import { useState } from 'react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { withAlpha } from '@/lib/course-color'
import { FOLDER_COLORS, FOLDER_ICONS, folderHex, FOLDER_ICON_MAP, DEFAULT_FOLDER_ICON } from './folder-style'

/**
 * New folder, or rename / restyle one. A class folder keeps its course's name
 * and colour (they follow the course), so only its icon can change here.
 */
export function FolderDialog({
  title,
  initial,
  isClass,
  onSave,
  onClose,
}: {
  title: string
  initial: { name: string; icon: string; color: string }
  isClass?: boolean
  onSave: (v: { name: string; icon: string; color: string }) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [icon, setIcon] = useState(initial.icon)
  const [color, setColor] = useState(initial.color)
  const Icon = FOLDER_ICON_MAP[icon] ?? DEFAULT_FOLDER_ICON
  const hex = folderHex(color)
  const valid = isClass || name.trim().length > 0

  return (
    <ModalShell label={title} onClose={onClose}>
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave({ name: name.trim(), icon, color })
        }}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: withAlpha(hex, 0.16), color: hex }}>
            <Icon size={24} aria-hidden />
          </span>
          {isClass ? (
            <p className="text-[16px] font-semibold text-fg">{initial.name}</p>
          ) : (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Folder name"
              aria-label="Folder name"
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-[15px] text-fg outline-none focus:border-accent"
            />
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-[12px] font-semibold tracking-wide text-subtle uppercase">Icon</legend>
          <div className="grid grid-cols-8 gap-1.5">
            {FOLDER_ICONS.map((it) => (
              <button
                key={it.key}
                type="button"
                title={it.label}
                aria-label={it.label}
                aria-pressed={icon === it.key}
                onClick={() => setIcon(it.key)}
                className={cn(
                  'grid aspect-square place-items-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
                  icon === it.key && 'bg-accent-soft text-accent',
                )}
              >
                <it.icon size={18} aria-hidden />
              </button>
            ))}
          </div>
        </fieldset>

        {!isClass && (
          <fieldset>
            <legend className="mb-2 text-[12px] font-semibold tracking-wide text-subtle uppercase">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  aria-pressed={color === c.id}
                  onClick={() => setColor(c.id)}
                  className={cn(
                    'size-8 rounded-full ring-offset-2 ring-offset-surface transition-transform duration-150 hover:scale-110',
                    color === c.id && 'ring-2 ring-fg',
                  )}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!valid}>
            Save
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
