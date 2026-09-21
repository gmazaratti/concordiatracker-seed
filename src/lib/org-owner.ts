import { supabase } from './supabase'

/**
 * Who receives a message sent to an organisation.
 *
 * An org has no inbox of its own — `messages` is between two people, and
 * giving a club a shared mailbox is a real feature with a real permission
 * model behind it (which member may read it, who is told about it, what
 * happens when they graduate). Until that exists, a reply reaches the account
 * that owns the club, which is a person who can answer.
 *
 * This is a deliberate placeholder, not an oversight: the alternative was
 * dropping story replies entirely, and the caller says so out loud when there
 * is nobody to receive one.
 */
export async function ownerIdForOrg(orgId: string): Promise<string | null> {
  const { data } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .maybeSingle()
  return (data as { owner_id?: string | null } | null)?.owner_id ?? null
}
