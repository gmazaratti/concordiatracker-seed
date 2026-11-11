import { useEffect, useState } from 'react'
import { Bold, Check, FolderOpen, Italic, List, ListChecks, Underline, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Stage, StepCopy } from './ObParts'
import { beam } from './ob-beam'
import { useOb } from './ob-i18n'

/**
 * Notes: the document editor almost nobody knows is built in.
 *
 * A small working page: a line you can type on, a checklist you can tick, and
 * the two things that make it more than a text box, shown rather than claimed:
 * it files itself under the right class and week, and it saves as you go.
 * A sandbox; the real editor (features/notes) opens on a computer.
 */
export function StepNotes({ touched, onTouch }: { touched: boolean; onTouch: () => void }) {
  const t = useOb()
  const [line, setLine] = useState('')
  const [todo, setTodo] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  // "Saving…" for a beat after each change, then "Saved": what autosave looks like.
  useEffect(() => {
    if (!saving) return
    const id = window.setTimeout(() => setSaving(false), 700)
    return () => window.clearTimeout(id)
  }, [saving, line, todo])
  const change = () => {
    setSaving(true)
    onTouch()
  }

  const tools = [Bold, Italic, Underline, List, ListChecks]
  return (
    <>
      <StepCopy label={t('notes.label')} title={t('notes.title')} sub={t('notes.sub')} note={t('notes.note')} />
      <Stage className="overflow-hidden !p-0">
        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          {tools.map((Icon, i) => (
            <span key={i} className="grid size-7 place-items-center rounded-md text-muted" aria-hidden>
              <Icon size={15} />
            </span>
          ))}
          <span className="ml-auto flex items-center gap-2 text-[11.5px] text-subtle">
            <span className="hidden items-center gap-1 sm:flex">
              <Users size={12} aria-hidden /> 2
            </span>
            <span key={String(saving)} className={cn('ct-ob-pop inline-flex items-center gap-1', !saving && 'text-success')}>
              {!saving && <Check size={12} strokeWidth={3} aria-hidden />}
              {saving ? t('notes.typing') : t('notes.saved')}
            </span>
          </span>
        </div>

        <div className="bg-canvas px-4 py-4 sm:px-6 sm:py-5">
          <p className="font-display text-[20px] font-semibold text-fg">{t('notes.doc')}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent">
            <FolderOpen size={12} aria-hidden /> {t('notes.linked')}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">{t('notes.seed1')}</p>
          <ul className="mt-2.5 space-y-1.5">
            {[t('notes.todo1'), t('notes.todo2')].map((label, i) => {
              const on = todo.has(i)
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      setTodo((s) => {
                        const n = new Set(s)
                        if (n.has(i)) n.delete(i)
                        else n.add(i)
                        return n
                      })
                      change()
                    }}
                    aria-pressed={on}
                    className="flex items-center gap-2.5 text-left text-[14px]"
                  >
                    <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-[5px] border-2 transition-colors duration-200', on ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong')}>
                      {on && <Check size={11} strokeWidth={3.5} className="ct-ob-check" aria-hidden />}
                    </span>
                    <span className={cn('transition-colors duration-200', on ? 'text-subtle line-through' : 'text-fg')}>{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <span className={cn('mt-3 block rounded-xl', beam(!touched))}>
            <input
              value={line}
              onChange={(e) => {
                setLine(e.target.value)
                change()
              }}
              placeholder={t('notes.placeholder')}
              aria-label={t('notes.placeholder')}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[14px] text-fg outline-none placeholder:text-subtle focus:border-accent"
            />
          </span>
        </div>
      </Stage>
    </>
  )
}
