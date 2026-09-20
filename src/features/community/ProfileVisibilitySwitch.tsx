import { useEffect, useState } from 'react'
import { IdCard, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Switch } from '@/features/settings/controls'
import { cn } from '@/lib/cn'

/**
 * "Show more than your name."
 *
 * BEING FOUND IS NO LONGER THIS SWITCH'S JOB. Anyone with a handle is
 * searchable now, and a private profile answers with a name and a picture --
 * enough to know you found the right person, and nothing else. So what is
 * left for this control to decide is how much of the profile is filled in:
 * program, bio, links.
 *
 * It is worth asking during setup anyway, because the fields it governs are
 * the ones someone has just been invited to fill in, and because a switch
 * nobody is ever shown is a switch nobody uses -- which is how the old one
 * ended up off on 32 of 37 accounts.
 */
export function ProfileVisibilitySwitch({
  className,
  compact = false,
}: {
  className?: string
  /** Onboarding renders the fuller explanation; in-app surfaces are terser. */
  compact?: boolean
}) {
  const [on, setOn] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    void supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id
      if (!id) return
      const { data: row } = await supabase
        .from('user_profile')
        .select('profile_public')
        .eq('user_id', id)
        .maybeSingle()
      // A missing column reads as "off", never as a broken switch.
      if (alive) setOn(!!(row as { profile_public?: boolean } | null)?.profile_public)
    })
    return () => {
      alive = false
    }
  }, [])

  async function toggle(next: boolean) {
    setOn(next) // optimistic: a switch that waits on a round trip feels broken
    setSaving(true)
    const { data } = await supabase.auth.getUser()
    const id = data.user?.id
    if (id) {
      const { error } = await supabase
        .from('user_profile')
        .update({ profile_public: next })
        .eq('user_id', id)
      if (error) setOn(!next) // put it back rather than lie about the state
    }
    setSaving(false)
  }

  if (on === null) return null

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-xl border border-border bg-surface px-3.5 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 gap-2.5">
        <IdCard size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-fg">Show a full profile</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
            {compact
              ? 'Adds your program, bio and links to your profile page. Classmates can find you by name either way.'
              : 'Adds your program, bio and links to your profile page. Classmates can already find you by name or handle; this decides how much they see when they get there. Your grades, classes and schedule each have their own switch and stay off.'}
          </p>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">
        {saving ? (
          <Loader2 size={16} className="animate-spin text-subtle" aria-hidden />
        ) : (
          <Switch checked={on} onChange={(v) => void toggle(v)} label="Show a full profile" />
        )}
      </div>
    </div>
  )
}
