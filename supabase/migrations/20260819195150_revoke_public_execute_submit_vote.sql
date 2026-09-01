-- Code review fix (Story 3.2): Postgres grants EXECUTE on a newly created
-- function to PUBLIC by default, so the explicit
-- `grant execute ... to anon, authenticated` in the previous migration was
-- cosmetic — any other role in the database could still call this
-- SECURITY DEFINER function. Standard hygiene for SECURITY DEFINER
-- functions is to revoke from PUBLIC first, then grant only to the roles
-- that actually need it.
revoke execute on function public.submit_vote(uuid, uuid, uuid, uuid, integer)
  from public;
