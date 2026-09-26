import { supabase } from '@/lib/supabase'

/** An assistant token (scope 'assistant', issued to the assistant identity). */
export interface AssistantToken {
  id: string
  name: string
  prefix: string
  created_at: string
  last_used_at: string | null
  use_count: number
  revoked_at: string | null
}

/** One write the assistant made, recorded by a database trigger. */
export interface AssistantAction {
  created_at: string
  action: string
  org_id: string | null
  org_handle: string | null
  org_name: string | null
  summary: string | null
}

export async function listAssistantTokens(): Promise<AssistantToken[]> {
  const { data, error } = await supabase.rpc('admin_assistant_tokens')
  if (error) throw new Error(error.message)
  return (data ?? []) as AssistantToken[]
}

/** Returns the token ONCE. Only its hash is stored. */
export async function createAssistantToken(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_create_assistant_token', { p_name: name })
  if (error) throw new Error(error.message)
  const row = (Array.isArray(data) ? data[0] : data) as { token?: string } | null
  if (!row?.token) throw new Error('No token came back.')
  return row.token
}

export async function revokeAssistantToken(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_revoke_assistant_token', { p_id: id })
  if (error) throw new Error(error.message)
}

export async function listAssistantActivity(limit = 200): Promise<AssistantAction[]> {
  const { data, error } = await supabase.rpc('admin_assistant_activity', { p_limit: limit })
  if (error) throw new Error(error.message)
  return (data ?? []) as AssistantAction[]
}

/** "assistant.org_stories.insert" -> "Posted a story". */
export function describeAction(action: string): string {
  const [, table, op] = action.split('.')
  const noun: Record<string, string> = {
    org_stories: 'a story',
    org_posts: 'a feed post',
    events: 'an event',
    organizations: 'the profile',
    org_members: 'a team invite',
  }
  const verb: Record<string, string> = { insert: 'Created', update: 'Edited', delete: 'Deleted' }
  if (table === 'organizations') return op === 'update' ? 'Edited the profile' : `${verb[op] ?? op} the club`
  if (table === 'org_members') return op === 'delete' ? 'Revoked a team invite' : 'Created a team invite'
  return `${verb[op] ?? op} ${noun[table] ?? table}`
}
