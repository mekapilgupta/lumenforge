-- ============================================================================
-- Migration: Fix abandoned_carts upsert (42P10)
-- Problem: syncAbandonedCart() upserts with onConflict: 'user_id' but the
--          table has no unique constraint on user_id.
-- Safe to re-run (idempotent).
-- ============================================================================

-- 1. Dedupe: keep the newest row per user
delete from public.abandoned_carts a
using public.abandoned_carts b
where a.user_id = b.user_id
  and a.last_updated < b.last_updated;

-- If last_updated is null on some rows, also dedupe by id ordering
delete from public.abandoned_carts a
using public.abandoned_carts b
where a.user_id = b.user_id
  and a.id > b.id
  and coalesce(a.last_updated, '') = coalesce(b.last_updated, '');

-- 2. Unique constraint — required for on_conflict = user_id upsert
alter table public.abandoned_carts
  add constraint uq_abandoned_carts_user_id unique (user_id);

-- 3. Reload schema cache
notify pgrst, 'reload schema';
