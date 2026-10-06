import { useEditorState, type Editor } from '@tiptap/react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Code, Highlighter, Italic, Link2, List, ListChecks,
  ImagePlus, ListOrdered, Minus, Plus, Quote, Redo2, RemoveFormatting, SeparatorHorizontal, SquareCode, Strikethrough,
  Underline, Undo2,
} from 'lucide-react'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { Select } from '@/components/ui/Select'
import { DEFAULT_FONT_SIZE, FONTS, FONT_SIZES, HIGHLIGHTS, TEXT_COLORS, ZOOMS } from './editor-extensions'
import { ToolBtn, ToolSep, ColorPopover, LinkPopover } from './toolbar-parts'

const STYLES = [
  { value: 'p', label: 'Normal text' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
]

/**
 * One line, like a word processor's: history, zoom, style, size, the inline
 * marks, colour, link, alignment and lists — and everything rarer behind More.
 * Every control is also a shortcut or a markdown rule, so nothing here is the
 * only way to do anything.
 */
export function NoteToolbar({ editor, zoom, onZoom, disabled, onImage }: {
  editor: Editor
  zoom: number
  onZoom: (z: number) => void
  disabled?: boolean
  onImage: () => void
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      font: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
      size: parseInt(String(e.getAttributes('textStyle').fontSize ?? ''), 10) || DEFAULT_FONT_SIZE,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      highlight: (e.getAttributes('highlight').color as string | undefined) ?? null,
      link: (e.getAttributes('link').href as string | undefined) ?? null,
      align: (['center', 'right', 'justify'] as const).find((a) => e.isActive({ textAlign: a })) ?? 'left',
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const c = () => editor.chain().focus()
  const setStyle = (v: string) => (v === 'p' ? c().setParagraph().run() : c().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run())
  const stepSize = (dir: 1 | -1) => {
    const next = dir > 0 ? FONT_SIZES.find((n) => n > s.size) : [...FONT_SIZES].reverse().find((n) => n < s.size)
    if (next) c().setFontSize(`${next}px`).run()
  }
  const AlignIcon = { left: AlignLeft, center: AlignCenter, right: AlignRight, justify: AlignJustify }[s.align]

  return (
    <div role="toolbar" aria-label="Formatting" aria-disabled={disabled}
      className={`ct-no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto ${disabled ? 'pointer-events-none opacity-45' : ''}`}>
      <ToolBtn icon={Undo2} label="Undo (Ctrl+Z)" onClick={() => c().undo().run()} disabled={!s.canUndo} />
      <ToolBtn icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={() => c().redo().run()} disabled={!s.canRedo} />
      <ToolSep />
      <Select size="sm" tone="control" ariaLabel="Zoom" value={String(zoom)} onChange={(v) => onZoom(Number(v))}
        options={ZOOMS.map((z) => ({ value: String(z), label: `${z}%` }))} className="w-[5.4rem] shrink-0" />
      <ToolSep />
      <Select size="sm" tone="control" ariaLabel="Font" value={s.font}
        onChange={(v) => (v ? c().setFontFamily(v).run() : c().unsetFontFamily().run())}
        options={FONTS.map((f) => ({ value: f.value ?? '', label: f.label }))} className="w-[8.4rem] shrink-0" />
      <ToolSep />
      <Select size="sm" tone="control" ariaLabel="Text style" value={s.style} onChange={setStyle} options={STYLES} className="w-[7.6rem] shrink-0" />
      <ToolSep />
      <ToolBtn icon={Minus} label="Smaller text" onClick={() => stepSize(-1)} />
      <span className="grid h-7 w-9 shrink-0 place-items-center rounded-md border border-border text-[12.5px] text-fg tabular-nums" aria-label="Text size">{s.size}</span>
      <ToolBtn icon={Plus} label="Larger text" onClick={() => stepSize(1)} />
      <ToolSep />
      <ToolBtn icon={Bold} label="Bold (Ctrl+B)" active={s.bold} onClick={() => c().toggleBold().run()} />
      <ToolBtn icon={Italic} label="Italic (Ctrl+I)" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <ToolBtn icon={Underline} label="Underline (Ctrl+U)" active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <ColorPopover label="Text colour" current={s.color} palette={TEXT_COLORS} glyph="A" noneLabel="Default colour"
        onPick={(v) => (v ? c().setColor(v).run() : c().unsetColor().run())} />
      <ColorPopover label="Highlight" current={s.highlight} palette={HIGHLIGHTS} icon={Highlighter} noneLabel="No highlight"
        onPick={(v) => (v ? c().setHighlight({ color: v }).run() : c().unsetHighlight().run())} />
      <ToolSep />
      <LinkPopover icon={Link2} current={s.link}
        onApply={(href) => c().extendMarkRange('link').setLink({ href }).run()}
        onRemove={() => c().extendMarkRange('link').unsetLink().run()} />
      <ToolBtn icon={ImagePlus} label="Insert image" onClick={onImage} />
      <DropdownMenu ariaLabel="Alignment" icon={AlignIcon} triggerClassName="size-8 shrink-0" items={[
        { id: 'l', label: 'Left', icon: AlignLeft, onSelect: () => c().setTextAlign('left').run() },
        { id: 'c', label: 'Center', icon: AlignCenter, onSelect: () => c().setTextAlign('center').run() },
        { id: 'r', label: 'Right', icon: AlignRight, onSelect: () => c().setTextAlign('right').run() },
        { id: 'j', label: 'Justify', icon: AlignJustify, onSelect: () => c().setTextAlign('justify').run() },
      ]} />
      <ToolSep />
      <ToolBtn icon={ListChecks} label="Checklist" active={s.task} onClick={() => c().toggleTaskList().run()} />
      <ToolBtn icon={List} label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
      <ToolBtn icon={ListOrdered} label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
      <DropdownMenu ariaLabel="More formatting" triggerClassName="size-8 shrink-0" items={[
        { id: 'strike', label: 'Strikethrough', icon: Strikethrough, onSelect: () => c().toggleStrike().run() },
        { id: 'code', label: 'Inline code', icon: Code, onSelect: () => c().toggleCode().run() },
        { id: 'block', label: 'Code block', icon: SquareCode, onSelect: () => c().toggleCodeBlock().run() },
        { id: 'quote', label: 'Quote', icon: Quote, onSelect: () => c().toggleBlockquote().run() },
        { id: 'hr', label: 'Divider line', icon: SeparatorHorizontal, onSelect: () => c().setHorizontalRule().run() },
        { id: 'clear', label: 'Clear formatting', icon: RemoveFormatting, separated: true, onSelect: () => c().unsetAllMarks().clearNodes().run() },
      ]} />
    </div>
  )
}
