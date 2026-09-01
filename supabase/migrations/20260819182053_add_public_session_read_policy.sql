-- Participants join sessions without a Supabase account (FR7), so the
-- existing admin-only RLS policy on `sessions` doesn't cover them — they
-- have no auth.uid() to match. This adds public read access, scoped to
-- SELECT only; write access remains restricted to the owning admin via the
-- existing "Admins manage their own sessions" policy.

create policy "Anyone can view sessions to join"
  on public.sessions
  for select
  using (true);
