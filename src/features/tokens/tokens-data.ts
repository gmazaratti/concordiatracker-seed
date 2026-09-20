import { supabase } from '@/lib/supabase'

/**
 * API tokens, client side.
 *
 * Kept in a plain `.ts` beside the panel so the component file exports only a
 * component — a `.tsx` exporting both loses fast refresh, which this codebase
 * has been bitten by twice.
 */

export type TokenScope = 'owner' | 'me' | 'support'

export interface ApiToken {
  id: string
  scope: TokenScope
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  use_count: number
  revoked_at: string | null
}

export async function listTokens(): Promise<ApiToken[]> {
  const { data, error } = await supabase.rpc('my_api_tokens')
  if (error) throw new Error(error.message)
  return (data ?? []) as ApiToken[]
}

/**
 * Mint one. The plaintext comes back HERE and nowhere else, ever — there is no
 * second call that can fetch it, which is why the panel makes a point of the
 * copy button rather than showing it quietly.
 */
export async function createToken(name: string, scope: TokenScope): Promise<string> {
  const { data, error } = await supabase.rpc('create_api_token', { p_name: name, p_scope: scope })
  if (error) throw new Error(error.message)
  const row = (data as { token?: string }[] | null)?.[0]
  if (!row?.token) throw new Error('The server did not return a token.')
  return row.token
}

export async function revokeToken(id: string): Promise<void> {
  // The result is read rather than assumed: a write nobody checks is how a
  // failed share reported "thanks" for weeks.
  const { data, error } = await supabase.rpc('revoke_api_token', { p_id: id })
  if (error) throw new Error(error.message)
  if (data !== true) throw new Error('That token was already revoked.')
}

/** "3 days ago", or "never". */
export function used(iso: string | null): string {
  if (!iso) return 'never used'
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return 'used just now'
  if (mins < 60) return `used ${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `used ${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `used ${days}d ago`
}
