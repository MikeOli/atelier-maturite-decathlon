-- "Qui a voté" indicator on the projected board, before reveal: the board
-- should show which participants have already cast a vote on the current
-- card, WITHOUT ever exposing the vote value itself — AC#2 ("no participant
-- sees another's vote before reveal", enforced by the "Votes are readable
-- once revealed" RLS policy on `public.votes`) must stay intact.
--
-- `participants` is already publicly readable (see
-- 20260819183315_create_participants.sql — the only non-public column
-- there is `client_token`), so the SECURITY DEFINER here exists solely to
-- bypass `votes`' restrictive SELECT policy for presence-checking — never to
-- expose participant identity, which was never protected. `value` is
-- deliberately absent from both the query and the return type: not a
-- redaction at the app layer, a real absence at the SQL layer.
create function public.get_voters_for_card(
  p_session_id uuid,
  p_card_id uuid
)
returns table (
  avatar_key text,
  avatar_label text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.avatar_key, p.avatar_label
  from public.votes v
  join public.participants p on p.id = v.participant_id
  where v.session_id = p_session_id
    and v.card_id = p_card_id;
$$;

grant execute on function public.get_voters_for_card(uuid, uuid)
  to anon, authenticated;

revoke execute on function public.get_voters_for_card(uuid, uuid)
  from public;
