import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { percentToGrade } from '@/lib/gpa'
import { GRADE_TARGETS } from '@/lib/gpa'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'

/** Suggest recent terms so people don't have to remember the exact wording. */
function recentTerms(count = 8): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const out: string[] = []
  for (let y = year; out.length < count; y--) {
    for (const s of ['Winter', 'Summer', 'Fall']) out.push(`${s} ${y}`)
  }
  return out.slice(0, count)
}

/** Enter a course from BEFORE you used the app — transcript-style: no
 * assessments, just the final grade you already earned. */
export function AddPastCourseModal({ onClose }: { onClose: () => void }) {
  const { addPastCourse } = useAppData()
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [termName, setTermName] = useState(recentTerms()[0])
  const [credits, setCredits] = useState('3')
  const [grade, setGrade] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const percent = Number(grade)
  const validGrade = grade.trim() !== '' && !isNaN(percent) && percent >= 0 && percent <= 100
  const canSave = code.trim().length > 0 && validGrade && !busy
  const letter = validGrade ? percentToGrade(percent).letter : null

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    setErr('')
    const id = await addPastCourse({
      code: code.trim(),
      title: title.trim(),
      term: termName,
      credits: Number(credits) || 3,
      finalPercent: percent,
    })
    if (!id) {
      setBusy(false)
      setErr('Couldn’t save that: please try again.')
      return
    }
    onClose()
  }

  const field =
    'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  return (
    <ModalShell label="Add a past course" onClose={onClose} widthClass="sm:max-w-md">
      <div className="p-5 sm:p-6">
        <h2 className="font-display text-[19px] font-semibold text-fg">Add a past course</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
          For classes you took before using ConcordiaTracker. Just the final grade: no assignments
          needed.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-muted">Course code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="COMP 248" className={field} autoFocus />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-muted">Credits</span>
              <input
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                type="number"
                min={0}
                max={12}
                step={0.5}
                className={field}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              Course name <span className="font-normal text-subtle">(optional)</span>
            </span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Object-Oriented Programming I" className={field} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block text-[12px] font-medium text-muted">Term</span>
              <Select
                value={termName}
                onChange={setTermName}
                options={recentTerms().map((t) => ({ value: t, label: t }))}
                ariaLabel="Term"
                tone="field"
              />
            </div>
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-muted">Final grade (%)</span>
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                type="number"
                min={0}
                max={100}
                placeholder="87"
                className={field}
              />
            </label>
          </div>

          {letter && (
            <p className="text-[12.5px] text-subtle">
              That&rsquo;s a <span className="font-semibold text-fg">{letter}</span> on the Concordia scale
              ({percentToGrade(percent).points.toFixed(1)} points).
            </p>
          )}
          {!letter && (
            <p className="text-[11.5px] text-subtle">
              Enter a percentage: we map it to a letter using the {GRADE_TARGETS.length + 1}-band Concordia
              scale.
            </p>
          )}
          {err && <p className="text-[12.5px] font-medium text-danger">{err}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!canSave} onClick={() => void save()}>
            {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
            Add to transcript
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
