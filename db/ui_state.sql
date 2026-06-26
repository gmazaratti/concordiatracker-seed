-- ============================================================================
-- Per-user UI state — a small jsonb bag for lightweight, cross-device UI flags:
-- the getting-started checklist's dismissed state, whether Community has been
-- visited, and which one-time coachmarks have been seen.
--   { "checklistDismissed": true, "communityVisited": true, "tipsSeen": ["…"] }
-- Own-row RLS already covers user_profile; this is just a column.
-- ============================================================================

alter table public.user_profile
  add column if not exists ui_state jsonb not null default '{}'::jsonb;
