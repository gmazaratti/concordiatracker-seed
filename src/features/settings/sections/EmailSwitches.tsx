import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { reportWriteError, writeErrorText } from '@/lib/write-errors'
import { Row, Switch } from '../controls'

type Col = 'email_digest' | 'email_product'

/**
 * The two email switches (db/email_prefs.sql). They used to be screen state
 * that reset on every open and sent nothing. Read from the account, written on
 * change, put back and reported if the write is refused.
 */
export function EmailSwitches() {
  const [prefs, setPrefs] = useState<Record<Col, boolean>>({ email_digest: true, email_product: false })

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) return
      const { data } = await supabase
        .from('user_profile')
        .select('email_digest, email_product')
        .eq('user_id', me.user.id)
        .maybeSingle()
      if (alive && data) setPrefs(data as Record<Col, boolean>)
    })()
    return () => {
      alive = false
    }
  }, [])

  function set(col: Col, v: boolean) {
    const before = prefs[col]
    setPrefs((p) => ({ ...p, [col]: v }))
    void (async () => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) return
      const { error } = await supabase.from('user_profile').update({ [col]: v }).eq('user_id', me.user.id)
      if (error) {
        setPrefs((p) => ({ ...p, [col]: before }))
        reportWriteError('That setting did not save', writeErrorText(error))
      }
    })()
  }

  return (
    <>
      <Row label="Weekly digest email" description="Every Monday morning: what is due in the week ahead, and anything still open.">
        <Switch checked={prefs.email_digest} onChange={(v) => set('email_digest', v)} label="Weekly digest email" />
      </Row>
      <Row label="Product updates" description="Occasional notes on what is new. Never more than a couple a month.">
        <Switch checked={prefs.email_product} onChange={(v) => set('email_product', v)} label="Product updates" />
      </Row>
    </>
  )
}
