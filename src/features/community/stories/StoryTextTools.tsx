import { Trash2 } from 'lucide-react'
import type { StoryOverlay } from '@/lib/social-posts'
import { cn } from '@/lib/cn'
import { STORY_ANIMS, STORY_COLORS, STORY_FONTS } from './story-text'

/**
 * Everything about the selected piece of text, under the photo.
 *
 * DARK, because it sits on the story's black surround, not on the app: the
 * composer is a camera screen, and a light panel under it would read as a
 * different app bolted on.
 */
export function StoryTextTools({
  overlay,
  onChange,
  onRemove,
  onDone,
}: {
  overlay: StoryOverlay
  onChange: (p: Partial<StoryOverlay>) => void
  onRemove: () => void
  onDone: () => void
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2 px-3 pt-2 text-white">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={overlay.text}
          onChange={(e) => onChange({ text: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && onDone()}
          maxLength={140}
          placeholder="Type something. @handle tags a club."
          className="min-w-0 flex-1 rounded-full bg-white/12 px-3.5 py-2 text-[14px] text-white placeholder:text-white/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove text"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 text-white/80 hover:text-white"
        >
          <Trash2 size={15} aria-hidden />
        </button>
        <button type="button" onClick={onDone} className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-black">
          Done
        </button>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        {STORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ color: c })}
            aria-label={`Colour ${c}`}
            aria-pressed={overlay.color === c}
            className={cn('size-7 shrink-0 rounded-full border-2', overlay.color === c ? 'border-white' : 'border-white/25')}
            style={{ background: c }}
          />
        ))}
        <span className="mx-1 h-5 w-px shrink-0 bg-white/20" />
        <Chip on={overlay.chip} onClick={() => onChange({ chip: !overlay.chip })}>
          Backdrop
        </Chip>
      </div>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {STORY_FONTS.map((f) => (
          <Chip key={f.id} on={overlay.font === f.id} onClick={() => onChange({ font: f.id })}>
            <span className={f.className}>{f.label}</span>
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px shrink-0 self-center bg-white/20" />
        {STORY_ANIMS.map((a) => (
          <Chip key={a.id} on={overlay.anim === a.id} onClick={() => onChange({ anim: a.id })}>
            {a.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        'shrink-0 rounded-full px-3 py-1 text-[12.5px] transition-colors',
        on ? 'bg-white text-black' : 'bg-white/12 text-white/80 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}
