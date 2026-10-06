import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'

const MAX_MS = 10 * 60_000

function pickType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) if (MediaRecorder.isTypeSupported(t)) return t
  return ''
}

/**
 * Record a voice note. Up to ten minutes, kept as a file in the note.
 * Nothing leaves the browser until you press Add; Discard throws it away.
 */
export function VoiceRecorder({ onAdd, onClose }: { onAdd: (blob: Blob, durationMs: number) => void; onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [ms, setMs] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (tick.current) clearInterval(tick.current)
    rec.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const start = async () => {
    const type = pickType()
    if (!type) {
      setState('error')
      setError('This browser cannot record audio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream, { mimeType: type })
      const parts: Blob[] = []
      r.ondataavailable = (e) => e.data.size && parts.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const b = new Blob(parts, { type: type.split(';')[0] })
        setBlob(b)
        setPreview(URL.createObjectURL(b))
        setState('done')
      }
      rec.current = r
      r.start(1000)
      setState('recording')
      let elapsed = 0
      tick.current = setInterval(() => {
        elapsed += 250
        setMs(elapsed)
        if (elapsed >= MAX_MS) stop()
      }, 250)
    } catch {
      setState('error')
      setError('Microphone access was not allowed.')
    }
  }
  const stop = () => {
    if (tick.current) clearInterval(tick.current)
    tick.current = null
    if (rec.current?.state === 'recording') rec.current.stop()
  }
  const clock = `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

  return (
    <ModalShell label="Record a voice note" onClose={onClose} widthClass="sm:max-w-sm">
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <h2 className="text-[16px] font-semibold text-fg">Voice note</h2>
        <span className={`grid size-20 place-items-center rounded-full ${state === 'recording' ? 'animate-pulse bg-danger/15 text-danger' : 'bg-accent-soft text-accent'}`}>
          <Mic size={32} aria-hidden />
        </span>
        <span className="text-[22px] font-semibold text-fg tabular-nums" aria-live="polite">{clock}</span>
        {state === 'error' && <p className="text-[13px] text-danger">{error}</p>}
        {state === 'done' && preview && <audio controls src={preview} className="w-full" />}
        <div className="flex gap-2">
          {state === 'idle' || state === 'error' ? (
            <Button onClick={() => void start()}><Mic size={15} aria-hidden />Start recording</Button>
          ) : state === 'recording' ? (
            <Button onClick={stop}><Square size={14} aria-hidden />Stop</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setBlob(null); setPreview(null); setMs(0); setState('idle') }}>Discard</Button>
              <Button onClick={() => blob && onAdd(blob, ms)}>Add to note</Button>
            </>
          )}
        </div>
        <p className="text-[12px] text-subtle">Up to 10 minutes. Anyone the note is shared with can play it.</p>
      </div>
    </ModalShell>
  )
}
