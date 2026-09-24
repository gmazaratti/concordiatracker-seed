import { supabase } from '@/lib/supabase'

/**
 * Publish the post half of a cross-post.
 *
 * RETURNS A REASON RATHER THAN THROWING, because the event itself has already
 * saved by the time this runs — failing the whole save because the companion
 * post was refused would be the tail wagging the dog. The caller shows the
 * reason next to the switch and the event stays saved.
 */
export async function crossPostEvent(input: {
  orgId: string
  eventId: string
  title: string
  image?: string
}): Promise<string | null> {
  /* A POST IS A PICTURE. `org_posts_media_ck` requires at least one media
     item — there is no text-only post in this product — so a cross-post of an
     event with no banner cannot exist. The switch says so BEFORE the save;
     this is the backstop, and it returns the same sentence rather than
     letting the database phrase it. */
  if (!input.image) return 'a feed post needs a picture, so add a banner image first'
  const caption = input.title.trim() ? `${input.title.trim()}. Details on the event.` : ''
  const media = [{ url: input.image, kind: 'image' as const }]
  const { error } = await supabase.from('org_posts').insert({
    org_id: input.orgId,
    caption,
    media,
    event_id: input.eventId,
  })
  if (!error) return null
  // A pending migration must cost the cross-post, never the event.
  if (error.code === 'PGRST204' || error.code === '42703') {
    const { error: retry } = await supabase
      .from('org_posts')
      .insert({ org_id: input.orgId, caption, media })
    return retry ? retry.message : null
  }
  return error.message
}
