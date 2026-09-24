/**
 * Delete failed syllabus uploads after 30 days.
 *
 * A failed upload is kept (bucket `parse-failures`, private) only so an admin
 * can retry it; the privacy policy says 30 days, so this is the thing that
 * makes the policy true. It rides on the daily Moodle cron because the plan
 * allows twelve functions and no more.
 *
 * Storage objects have to be deleted through the Storage API — deleting the
 * row in `storage.objects` leaves the file behind — so this lists the paths
 * from `parse_events`, removes them in one call, and clears the pointer.
 * Never throws: a cleanup that fails must not take the Moodle sync with it.
 */
export const KEEP_FAILED_DAYS = 30

export async function cleanupFailedParses(url: string, serviceKey: string): Promise<number> {
  const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  try {
    const cutoff = new Date(Date.now() - KEEP_FAILED_DAYS * 86_400_000).toISOString()
    const r = await fetch(
      `${url}/rest/v1/parse_events?select=id,file_path&file_path=not.is.null&created_at=lt.${cutoff}&limit=500`,
      { headers: svc },
    )
    if (!r.ok) return 0
    const rows = (await r.json()) as { id: string; file_path: string }[]
    if (rows.length === 0) return 0
    await fetch(`${url}/storage/v1/object/parse-failures`, {
      method: 'DELETE',
      headers: { ...svc, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: rows.map((x) => x.file_path) }),
    })
    await fetch(`${url}/rest/v1/parse_events?id=in.(${rows.map((x) => x.id).join(',')})`, {
      method: 'PATCH',
      headers: { ...svc, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ file_path: null }),
    })
    return rows.length
  } catch {
    return 0
  }
}
