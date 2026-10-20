-- Le transcript était effacé à la clôture quelle que soit l'issue de la
-- synthèse IA. Quand Gemini échouait (503 passager côté Google, mesuré à
-- ~2 appels sur 3 le 2026-10-20), la session se fermait sans synthèse ET
-- sans transcript : la matière première disparaissait, rendant toute
-- nouvelle tentative impossible.
--
-- Le transcript n'est désormais effacé que lorsqu'une synthèse existe —
-- celle qu'on vient de produire, ou celle déjà stockée par une clôture
-- antérieure réussie. Sinon il est conservé tel quel, ce qui permet de
-- relancer la synthèse plus tard. Même expression que le `coalesce` déjà
-- utilisé juste en dessous pour ai_synthesis, afin que les deux colonnes
-- ne puissent jamais diverger.
create or replace function public.close_session_as_facilitator(
  p_session_id uuid,
  p_facilitator_token uuid,
  p_ai_synthesis jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_card_id uuid;
  v_votes_revealed boolean;
  v_has_consensus boolean;
begin
  select current_card_id, votes_revealed
    into v_current_card_id, v_votes_revealed
  from public.sessions
  where id = p_session_id
    and facilitator_token = p_facilitator_token;

  if not found then
    raise exception 'invalid facilitator token' using errcode = 'FT001';
  end if;

  if v_votes_revealed and v_current_card_id is not null then
    select exists (
      select 1 from public.card_consensus
      where session_id = p_session_id
        and card_id = v_current_card_id
    ) into v_has_consensus;

    if not v_has_consensus then
      raise exception 'consensus required before closing' using errcode = 'FT009';
    end if;
  end if;

  update public.sessions
    set status = 'CLOTUREE',
      transcript_draft = case
        when coalesce(p_ai_synthesis, ai_synthesis) is not null then null
        else transcript_draft
      end,
      transcription_enabled = false,
      ai_synthesis = coalesce(p_ai_synthesis, ai_synthesis)
    where id = p_session_id;
end;
$$;
