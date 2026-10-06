import { useMemo, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { ArrowLeft, ArrowRight, Check, Copy, RotateCcw, Shuffle, X } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { makeCards, makeGuide, makeQuiz, type Card } from './study'

type Tab = 'cards' | 'quiz' | 'guide'

/**
 * Flashcards, a quiz and a study guide made from this note. Anyone the note is
 * shared with can open them: they are built from the note, not stored apart
 * from it, so they are always as current as the note.
 */
export function StudyDialog({ title, content, onClose }: { title: string; content: JSONContent; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('cards')
  const cards = useMemo(() => makeCards(content), [content])
  return (
    <ModalShell label="Study" onClose={onClose} widthClass="sm:max-w-2xl">
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-[16px] font-semibold text-fg">Study: {title || 'Untitled note'}</h2>
          <p className="text-[12.5px] text-muted">Made from your note. Write “Term: definition”, start a line in <b>bold</b>, or use headings, and they become cards.</p>
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Study tools">
          {([['cards', `Flashcards (${cards.length})`], ['quiz', 'Quiz'], ['guide', 'Study guide']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium', tab === id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'cards' && <Flashcards cards={cards} />}
        {tab === 'quiz' && <Quiz cards={cards} />}
        {tab === 'guide' && <Guide content={content} />}
      </div>
    </ModalShell>
  )
}

function Empty({ need }: { need: number }) {
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-subtle">This needs at least {need} {need === 1 ? 'card' : 'cards'}. Add a few lines like “Opportunity cost: the next best alternative given up”.</p>
}

function Flashcards({ cards: initial }: { cards: Card[] }) {
  const [cards, setCards] = useState(initial)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(0)
  const [copied, setCopied] = useState(false)
  if (!cards.length) return <Empty need={1} />
  const c = cards[i % cards.length]
  const go = (d: number) => { setFlipped(false); setI((x) => (x + d + cards.length) % cards.length) }
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Show the term' : 'Show the answer'}
        className="grid min-h-48 place-items-center rounded-2xl border border-border bg-surface-2/60 p-6 text-center transition-colors duration-150 hover:border-border-strong">
        <span className={cn('whitespace-pre-wrap', flipped ? 'text-[15px] text-fg' : 'text-[20px] font-semibold text-fg')}>{flipped ? c.back : c.front}</span>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => go(-1)} aria-label="Previous card"><ArrowLeft size={14} aria-hidden /></Button>
        <span className="text-[12.5px] text-muted tabular-nums">{(i % cards.length) + 1} / {cards.length}</span>
        <Button variant="outline" size="sm" onClick={() => go(1)} aria-label="Next card"><ArrowRight size={14} aria-hidden /></Button>
        <Button variant="outline" size="sm" onClick={() => { setCards([...cards].sort(() => Math.random() - 0.5)); setI(0); setFlipped(false) }}><Shuffle size={14} aria-hidden />Shuffle</Button>
        <span className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => go(1)}><RotateCcw size={14} aria-hidden />Again</Button>
          <Button size="sm" onClick={() => { setKnown((k) => k + 1); go(1) }}><Check size={14} aria-hidden />Knew it ({known})</Button>
        </span>
      </div>
      <button type="button" className="inline-flex items-center gap-1.5 self-start text-[12.5px] text-accent hover:underline"
        onClick={() => void navigator.clipboard.writeText(cards.map((x) => `${x.front}\t${x.back}`).join('\n')).then(() => setCopied(true))}>
        <Copy size={13} aria-hidden />{copied ? 'Copied: paste into Quizlet or Anki import' : 'Copy all cards (term ⇥ definition, for Quizlet or Anki)'}
      </button>
    </div>
  )
}

function Quiz({ cards }: { cards: Card[] }) {
  const [seed, setSeed] = useState(1)
  const qs = useMemo(() => makeQuiz(cards, seed), [cards, seed])
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  if (qs.length === 0) return <Empty need={4} />
  if (i >= qs.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-[22px] font-semibold text-fg">{score} / {qs.length}</p>
        <Button onClick={() => { setSeed((s) => s + 1); setI(0); setScore(0); setPicked(null) }}><RotateCcw size={14} aria-hidden />Try again</Button>
      </div>
    )
  }
  const q = qs[i]
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-subtle tabular-nums">Question {i + 1} of {qs.length} · Which term is this?</p>
      <p className="rounded-xl bg-surface-2/60 p-4 text-[15px] text-fg">{q.question}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.choices.map((ch, k) => (
          <button key={k} type="button" disabled={picked !== null}
            onClick={() => { setPicked(k); if (k === q.answer) setScore((s) => s + 1) }}
            className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[13.5px] text-fg transition-colors duration-150',
              picked === null ? 'border-border hover:bg-surface-2' : k === q.answer ? 'border-success bg-success/10' : k === picked ? 'border-danger bg-danger/10' : 'border-border opacity-60')}>
            {picked !== null && k === q.answer && <Check size={15} className="text-success" aria-hidden />}
            {picked === k && k !== q.answer && <X size={15} className="text-danger" aria-hidden />}
            {ch}
          </button>
        ))}
      </div>
      {picked !== null && <Button className="self-end" onClick={() => { setI((x) => x + 1); setPicked(null) }}>Next</Button>}
    </div>
  )
}

function Guide({ content }: { content: JSONContent }) {
  const guide = useMemo(() => makeGuide(content), [content])
  if (!guide.length) return <p className="text-[13px] text-subtle">Add headings and bold the key terms, and the guide builds itself from them.</p>
  return (
    <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
      {guide.map((s, i) => (
        <section key={i}>
          <h3 className="text-[14px] font-semibold text-fg">{s.heading}</h3>
          {s.terms.length > 0 && <p className="mt-1 text-[13px] text-muted">Key terms: {s.terms.join(', ')}</p>}
          {s.todo.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-[13px] text-muted">{s.todo.map((t, k) => <li key={k}>Still to do: {t}</li>)}</ul>
          )}
        </section>
      ))}
    </div>
  )
}
