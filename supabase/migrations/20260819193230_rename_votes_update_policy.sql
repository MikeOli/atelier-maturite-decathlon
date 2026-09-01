-- Code review fix (Story 3.1): the previous UPDATE policy name was 67
-- bytes, so Postgres silently truncated it to
-- "Participants can update their vote on the current card before r" —
-- and the migration that later dropped/recreated it had to reproduce that
-- exact truncation to target it. Renamed to something short and
-- deliberate so this never happens again.
alter policy "Participants can update their vote on the current card before r"
  on public.votes
  rename to "votes_update_before_reveal";
