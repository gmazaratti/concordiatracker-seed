import { useEffect, useState } from 'react'
import { Laptop, Loader2, Smartphone, Tablet } from 'lucide-react'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { describeUserAgent, listDevices, revokeSession, type Device } from '@/lib/devices'
import { useI18n } from '@/i18n/i18n'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { Group, Row } from '../controls'

/**
 * Settings → Devices: where this account is signed in, where it was, and a way
 * to end any of it.
 *
 * Live sessions come from Supabase's own table; past ones from our 90-day
 * history (db/devices.sql), because Supabase deletes a session on sign-out.
 * Every action is scoped to the caller in the database, not here.
 */
export function DevicesSection() {
  const { t, lang } = useI18n()
  const { signOut } = useAuth()
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)
  // The clock the "2 hours ago" labels count from, taken when the list lands.
  const [loadedAt, setLoadedAt] = useState(0)
  const [armed, setArmed] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listDevices().then(
      (d) => {
        if (!active) return
        setDevices(d)
        setLoadedAt(Date.now())
        setFailed(false)
      },
      () => active && setFailed(true),
    )
    return () => {
      active = false
    }
  }, [tick])
  const reload = () => setTick((n) => n + 1)

  const rtf = new Intl.RelativeTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-US', { numeric: 'auto' })
  const ago = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - loadedAt) / 60000)
    if (Math.abs(mins) < 2) return t('devices.now')
    if (Math.abs(mins) < 60) return rtf.format(mins, 'minute')
    const hours = Math.round(mins / 60)
    if (Math.abs(hours) < 48) return rtf.format(hours, 'hour')
    return rtf.format(Math.round(hours / 24), 'day')
  }

  /* Two presses for anything that signs somebody out: the first arms it, the
     second does it. A stray tap on a phone should not end a session. */
  async function act(key: string, fn: () => Promise<unknown>) {
    if (armed !== key) {
      setArmed(key)
      return
    }
    setArmed(null)
    setBusy(key)
    try {
      await fn()
    } finally {
      setBusy(null)
      reload()
    }
  }

  const active = devices?.filter((d) => d.is_active) ?? []
  const past = devices?.filter((d) => !d.is_active) ?? []
  const others = active.filter((d) => !d.is_current)

  if (failed) {
    return (
      <Group label={t('settings.devices')} padded>
        <p className="text-[13px] text-muted">{t('devices.error')}</p>
        <Button size="sm" variant="outline" onClick={reload}>
          {t('devices.retry')}
        </Button>
      </Group>
    )
  }
  if (!devices) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-accent" aria-label={t('devices.loading')} />
      </div>
    )
  }

  const row = (d: Device, live: boolean) => {
    const name = describeUserAgent(d.user_agent)
    const Icon = name.kind === 'phone' ? Smartphone : name.kind === 'tablet' ? Tablet : Laptop
    const key = `one:${d.session_id}`
    return (
      <div key={d.session_id} className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
          <Icon size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
            <span className="truncate">{t('devices.on', { browser: name.browser, os: name.os })}</span>
            {d.is_current && (
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                {t('devices.thisDevice')}
              </span>
            )}
          </p>
          <p className="truncate text-[12px] text-subtle">
            {t(live ? 'devices.lastActive' : 'devices.lastSeen', { when: ago(d.last_active) })}
            {d.ip ? ` · ${d.ip}` : ''}
          </p>
        </div>
        {live && !d.is_current && (
          <button
            type="button"
            disabled={busy === key}
            onClick={() => void act(key, () => revokeSession(d.session_id))}
            className={cn(
              'shrink-0 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors',
              armed === key
                ? 'border-danger/50 bg-danger/10 text-danger'
                : 'border-border text-muted hover:text-fg',
            )}
          >
            {armed === key ? t('devices.confirm') : t('devices.signOut')}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <Group label={t('devices.activeTitle')}>
        {active.map((d) => row(d, true))}
        {others.length === 0 && (
          <p className="px-4 py-3 text-[12.5px] text-subtle">{t('devices.none')}</p>
        )}
      </Group>

      <Group label={t('devices.security')}>
        <Row label={t('devices.signOutOthers')} description={t('devices.signOutOthersDesc')}>
          <Button
            size="sm"
            variant="outline"
            disabled={others.length === 0 || busy === 'others'}
            onClick={() => void act('others', () => supabase.auth.signOut({ scope: 'others' }))}
          >
            {armed === 'others' ? t('devices.confirm') : t('devices.signOut')}
          </Button>
        </Row>
        <Row label={t('devices.signOutAll')} description={t('devices.signOutAllDesc')}>
          <Button
            size="sm"
            variant="outline"
            disabled={busy === 'all'}
            onClick={() => void act('all', () => supabase.auth.signOut({ scope: 'global' }).then(signOut))}
          >
            {armed === 'all' ? t('devices.confirm') : t('devices.signOut')}
          </Button>
        </Row>
        <p className="px-4 pb-3 text-[11.5px] leading-relaxed text-subtle">{t('devices.note')}</p>
      </Group>

      <Group label={t('devices.pastTitle')}>
        {past.length > 0 ? (
          past.map((d) => row(d, false))
        ) : (
          <p className="px-4 py-3 text-[12.5px] text-subtle">{t('devices.noPast')}</p>
        )}
      </Group>
    </>
  )
}
