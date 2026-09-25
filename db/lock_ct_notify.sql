-- ct_notify is the one function that writes a notification. It was executable
-- by anon, authenticated and PUBLIC, so any signed-in account could call it
-- through the API and put a notification, with any title, body, link and
-- "from" name, into anybody's list. A convincing fake alert with a link is a
-- phishing tool.
--
-- Nothing legitimate needs a user to call it: the nine database functions
-- that do (follows, request status and comments, org posts, collabs, invites,
-- roles, ownership transfer) are SECURITY DEFINER owned by postgres, and the
-- two server callers (api/admin.ts, api/_moodle.ts) use the service role.
-- Checked 2026-09-25 before revoking. Idempotent.
revoke execute on function public.ct_notify(uuid[], text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.ct_notify(uuid[], text, text, text, text, uuid, text) to service_role;
