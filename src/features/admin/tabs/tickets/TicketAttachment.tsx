import { useEffect, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * A file the student attached when the uploader could not read their syllabus
 * (sendSyllabusToSupport). Read from the ticket's context, which admins can
 * see; opened through a short-lived signed link from the private bucket.
 */
export function TicketAttachment({ ticketId }: { ticketId: string }) {
  const [file, setFile] = useState<{ path: string; name: string } | null>(null)
  useEffect(() => {
    let alive = true
    void supabase
      .from('tickets')
      .select('context')
      .eq('id', ticketId)
      .maybeSingle()
      .then(({ data }) => {
        const c = (data as { context?: { file_path?: string; file_name?: string } } | null)?.context
        if (alive) setFile(c?.file_path ? { path: c.file_path, name: c.file_name ?? 'Attached file' } : null)
      })
    return () => {
      alive = false
    }
  }, [ticketId])
  if (!file) return null
  async function open() {
    const { data } = await supabase.storage.from('parse-failures').createSignedUrl(file!.path, 600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }
  return (
    <button
      type="button"
      onClick={() => void open()}
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-fg hover:border-accent"
    >
      <Paperclip size={13} className="shrink-0" aria-hidden />
      <span className="truncate">{file.name}</span>
    </button>
  )
}
