-- ── JMMA handoff fix ─────────────────────────────────────────────────────────
-- You used an alt account + the JMMA link (a CREATE invite) to build @jmmaonline
-- (1/2 used). The REMAINING use can't create again — the handle's taken. So it
-- must hand the org OFF to JMMA's real team instead. This:
--   • points the remaining invite use at the existing @jmmaonline org (handoff),
--   • removes the alt account's ownership + membership,
--   • resets the org to PENDING so JMMA's real claimant gets the onboarding and
--     you re-approve (the profile the alt built is kept).
-- After JMMA accepts the same link, they become the real owner of the fully
-- set-up org, see onboarding, and you approve it.
--
-- Token is from the link you sent. Safe to re-run.

update public.org_invites i
set org_id = o.id
from public.organizations o
where i.token = 'oiv_74b26d5315c44827aa4f' and o.handle = '@jmmaonline';

delete from public.org_members m
using public.organizations o
where m.org_id = o.id and o.handle = '@jmmaonline';

update public.organizations
set owner_id = null, status = 'pending'
where handle = '@jmmaonline';
