import { supabase } from './supabase'

/**
 * "This person used this feature", for the few features only the browser can
 * see (opening a panel, previewing an outline). Everything with a database
 * write is recorded by a trigger instead (db/product_analytics.sql), so it
 * cannot be forgotten by a call site.
 *
 * The server decides everything that matters: it refuses an unknown feature,
 * records at most one per person per feature per day, and records nothing for
 * someone who opted out. So this is fire-and-forget and never throws.
 */
export type ClientFeature = 'quick_links' | 'blueprint_preview' | 'blueprint_import' | 'notifications_open'

export function trackFeature(feature: ClientFeature): void {
  // A PostgREST builder only sends when something subscribes to it, so
  // `void supabase.rpc(...)` would silently do nothing.
  supabase.rpc('track_feature', { p_feature: feature }).then(
    () => {},
    () => {},
  )
}
