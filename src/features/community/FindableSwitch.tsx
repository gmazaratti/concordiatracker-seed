import { useEffect, useState } from 'react'
import { Loader2, UserSearch } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Switch } from '@/features/settings/controls'
import { cn } from '@/lib/cn'

/**
 * "Let classmates find me."
 *
 * WHY THIS COMPONENT EXISTS. Searching a classmate's handle returned nothing,
 * and it was not an indexing delay: `search_public_profiles` filters on
 * `profile_public`, which defaults to false and which nothing ever turns on.
 * Measured against production — 37 accounts have a handle and 5 are findable.
 * Searching the exact handle of any of the other 32 returns zero rows.
 *
 * THE SETTING WAS NOT THE PROBLEM; ITS LABEL WAS. It reads "Public profile —
 * show your profile at /@handle", which describes a PAGE. Nothing anywhere
 * said that the same switch is what decides whether a classmate typing your
 * name finds you, so nobody had a reason to look for it.
 *
 * AND NOTHING HERE FLIPS IT FOR ANYONE. Turning 32 people public to fix a
 * search bug would publish 32 profiles that nobody asked to publish. This is
 * the same switch, put where the absence is actually felt, saying what it
 * really does.
 */
export function FindableSwitch({
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
        <UserSearch size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-fg">Let classmates find you</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
            {compact
              ? 'Your name and handle turn up when someone searches. Off by default.'
              : 'Someone searching your name or handle in Community can find you, and your profile page works. Your grades, courses and schedule each have their own switch and stay off.'}
          </p>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">
        {saving ? (
          <Loader2 size={16} className="animate-spin text-subtle" aria-hidden />
        ) : (
          <Switch checked={on} onChange={(v) => void toggle(v)} label="Let classmates find you" />
        )}
      </div>
    </div>
  )
}
