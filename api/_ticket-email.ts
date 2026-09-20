/**
 * Telling a customer they have a reply.
 *
 * UNTIL NOW NOTHING DID. The only email this product had ever sent was the
 * Stripe renewal notice, so a support reply landed in a thread the customer
 * had to already be looking at to see. Answering someone and then closing
 * their ticket without a word reaching them is worse than not answering: it
 * looks, from their side, exactly like being ignored.
 *
 * WHY THE SERVER AND NOT A TRIGGER. The Resend key cannot go near a browser,
 * and a database trigger would need pg_net plus the key in Postgres. This is
 * one POST from a function that already has the secret.
 *
 * IT NEVER THROWS. The reply is already stored by the time this runs; failing
 * the request because a mail provider hiccupped would turn a delivered answer
 * into an error message and tempt someone into sending it twice.
 */
import { sendEmail } from './_email.js'

const SITE = process.env.PUBLIC_SITE_URL ?? 'https://concordiatracker.com'

interface Ticket {
  id: string
  case_id: string
  email: string
  name: string | null
  subject: string
  user_id: string | null
  lookup_token: string | null
}

interface Message {
  body: string
  author_role: string
  created_at: string
}

function svc() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url, key } : null
}

/**
 * Email the customer about the latest non-customer message on a ticket.
 *
 * Reads the message back from the database rather than taking it as an
 * argument: what is sent is then necessarily what was stored, and a caller
 * cannot email one thing while saving another.
 */
export async function notifyTicketReply(ticketId: string): Promise<boolean> {
  const s = svc()
  if (!s) return false
  const h = { apikey: s.key, Authorization: `Bearer ${s.key}` }

  const [tickets, messages] = await Promise.all([
    fetch(
      `${s.url}/rest/v1/tickets?id=eq.${ticketId}&select=id,case_id,email,name,subject,user_id,lookup_token`,
      { headers: h },
    )
      .then((r) => (r.ok ? (r.json() as Promise<Ticket[]>) : []))
      .catch(() => [] as Ticket[]),
    fetch(
      `${s.url}/rest/v1/ticket_messages?ticket_id=eq.${ticketId}&select=body,author_role,created_at&order=created_at.desc&limit=1`,
      { headers: h },
    )
      .then((r) => (r.ok ? (r.json() as Promise<Message[]>) : []))
      .catch(() => [] as Message[]),
  ])

  const ticket = tickets[0]
  const last = messages[0]
  if (!ticket?.email || !last) return false
  // Only ever about an answer. A customer does not need an email telling them
  // what they themselves just wrote.
  if (last.author_role === 'user') return false

  // Signed-in people land in the app; anonymous reporters get the lookup link
  // that is the only way they can read the thread at all.
  const href =
    ticket.user_id || !ticket.lookup_token
      ? `${SITE}/app?support=1`
      : `${SITE}/docs/support-status?case=${encodeURIComponent(ticket.case_id)}&token=${encodeURIComponent(ticket.lookup_token)}`

  const first = (ticket.name ?? '').trim().split(/\s+/)[0]

  return sendEmail({
    to: ticket.email,
    subject: `Re: ${ticket.subject} (${ticket.case_id})`,
    heading: 'You have a reply',
    paragraphs: [
      first ? `Hi ${first},` : 'Hi,',
      'We have replied to your support request:',
      // The reply itself, so a short answer needs no click at all.
      last.body,
    ],
    button: { label: 'Open the conversation', href },
    facts: [
      { label: 'Case', value: ticket.case_id },
      { label: 'Subject', value: ticket.subject },
    ],
    footnote: 'Reply in the app and we will see it — this address is not monitored.',
  })
}
