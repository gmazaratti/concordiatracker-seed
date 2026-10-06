import { useEditorState, type Editor } from '@tiptap/react'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The formatting bar. Every button is also a keyboard shortcut or a markdown
 * shortcut ("# " for a heading, "- [ ] " for a checklist, "```" for code), so
 * the bar is for people who reach for the mouse, not the only way in.
 *
 * `useEditorState` re-renders the bar only when one of the active flags
 * changes, rather than on every keystroke the editor makes.
 */
export function EditorToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      codeBlock: e.isActive('codeBlock'),
      quote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const c = () => editor.chain().focus()

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 border-b border-border px-3 py-1.5"
    >
      <Btn icon={Undo2} label="Undo (Ctrl+Z)" onClick={() => c().undo().run()} disabled={!s.canUndo} />
      <Btn icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={() => c().redo().run()} disabled={!s.canRedo} />
      <Sep />
      <Btn icon={Heading1} label="Heading 1" active={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} />
      <Btn icon={Heading2} label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Btn icon={Heading3} label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      <Sep />
      <Btn icon={Bold} label="Bold (Ctrl+B)" active={s.bold} onClick={() => c().toggleBold().run()} />
      <Btn icon={Italic} label="Italic (Ctrl+I)" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <Btn icon={Underline} label="Underline (Ctrl+U)" active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <Btn icon={Strikethrough} label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()} />
      <Btn icon={Code} label="Inline code" active={s.code} onClick={() => c().toggleCode().run()} />
      <Sep />
      <Btn icon={List} label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
      <Btn icon={ListOrdered} label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
      <Btn icon={ListChecks} label="Checklist" active={s.task} onClick={() => c().toggleTaskList().run()} />
      <Sep />
      <Btn icon={Quote} label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()} />
      <Btn icon={SquareCode} label="Code block" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()} />
    </div>
  )
}

function Btn({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // mousedown, not click: keeps the selection in the editor so the format
      // applies to the text that was selected.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-35',
        active && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
      )}
    >
      <Icon size={16} aria-hidden />
    </button>
  )
}

const Sep = () => <span aria-hidden className="mx-1 h-5 w-px bg-border" />
