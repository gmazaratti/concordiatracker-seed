import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'

/**
 * Something to read while the parser works.
 *
 * A fifteen-second wait with a progress shimmer and nothing else is fifteen
 * seconds of wondering whether it has hung. This is the oldest trick in loading
 * screens and it works for the oldest reason: attention spent reading is
 * attention not spent counting.
 *
 * Every line is TRUE and about this app — not filler trivia. Half of them teach
 * a feature people do not find on their own (which is the same job the Tips
 * carousel does in the builder), and the rest set expectations about what the
 * parser will and will not get right, which is worth saying before the results
 * land rather than after.
 */
const TIPS: string[] = [
  'You can correct anything it gets wrong. Nothing here is final, and editing a date takes one click.',
  'A final exam with no date stays TBA rather than being given one — it shows against the exam period on your calendar instead.',
  'Weights that do not add to 100% get flagged, because that is almost always a line the parser missed rather than a syllabus that is wrong.',
  'Dates from a professor’s own outline are marked Official. Ones you type yourself are simply yours — no badge, no doubt cast.',
  'Grade-needed is free forever: it tells you the average you need on what is left to finish with the grade you want.',
  'Blocked out your Thursday shift in the schedule builder? Everything you generate afterwards works around it.',
  'Right-click a class on the schedule builder’s week to pin it, hide it, or see its room and seat counts.',
  'Uploading your outline helps the next student in your section too — it becomes a blueprint they can import in one click.',
  'The seat watcher checks a full section for you and tells you the moment a place opens, with the class number ready to paste.',
  'Concordia’s schedule feed does not publish who teaches a section, so we never guess at an instructor’s name.',
  'You can drag your classes into whatever order you like on the Courses page. It sticks, and it follows you between devices.',
  'Everything on your schedule is a plan, never a registration. Registering still happens in the Student Centre.',
]

/** Long enough to read a sentence, short enough that a 15-second wait shows
 *  three or four. Under 4s it reads as flicker; over 6s it stops feeling alive. */
const EVERY_MS = 4600

export function ScanTips({ className }: { className?: string }) {
  // A random start so the same three lines are not shown on every import — and
  // seeded once, in state, rather than recomputed on render (which would be a
  // purity violation as well as a tip that changes mid-sentence).
  const [start] = useState(() => Math.floor(Math.random() * TIPS.length))
  const [n, setN] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setN((i) => i + 1), EVERY_MS)
    return () => clearInterval(timer)
  }, [])

  const tip = TIPS[(start + n) % TIPS.length]

  return (
    <div
      className={className}
      // Announced politely rather than assertively: it is diversion, not news,
      // and a screen reader interrupting itself every five seconds is worse
      // than silence.
      aria-live="polite"
    >
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-subtle">
        <Lightbulb size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        {/* Keyed so each line fades in on its own rather than swapping mid-read. */}
        <span key={tip} className="ct-animate-pop">
          <span className="font-medium text-muted">Did you know · </span>
          {tip}
        </span>
      </p>
    </div>
  )
}
