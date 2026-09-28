import { supabase } from './supabase'
import { rememberedUid } from './offline-fetch'

/**
 * Who is signed in, answered by THIS DEVICE rather than the auth server.
 *
 * `supabase.auth.getUser()` is a network request. Code that only needs the
 * account's id (to address a message, to filter "my" rows) used it anyway, so
 * in airplane mode it concluded nobody was signed in: the chat refused to send
 * ("You need to be signed in") and loaded an empty thread. The session is
 * already on the device; and if its token expired while offline (renewing it
 * needs the network), the account it belonged to is remembered by the offline
 * layer until sign-out.
 *
 * The same shape as getUser's answer, so a call site swaps one for the other
 * without touching the lines after it. Only `id` is filled in: anything that
 * needs the server's fresh copy of the user should still call getUser.
 */
export async function localUser(): Promise<{ data: { user: { id: string } | null } }> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id ?? rememberedUid()
  return { data: { user: id ? { id } : null } }
}
