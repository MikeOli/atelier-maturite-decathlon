-- Backfill: the "Maturité Produit" deck seeded before the is_default column
-- existed needs the flag set so it's recognized as each admin's default.
update public.decks
set is_default = true
where name = 'Maturité Produit'
  and not is_default;
