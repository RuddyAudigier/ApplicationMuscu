-- 2026-11-24 — Planning de la semaine (jours d'entraînement, décalages et sauts ponctuels).
-- Migration ADDITIVE et IDEMPOTENTE : rejouable sans risque.
-- Tant qu'elle n'est pas jouée, l'app garde le planning dans le localStorage de l'appareil
-- (clé `mymuscle_week_plan_v1`), sans synchronisation entre appareils.
--
-- À exécuter dans l'éditeur SQL Supabase.

create table if not exists week_plan (
  id         int primary key default 1 check (id = 1),
  -- 7 valeurs, lundi → dimanche : rang de séance dans le cycle (0 = A1/B1) ou null (repos).
  days       jsonb not null default '[null,null,null,null,null,null,null]'::jsonb,
  -- Exceptions ponctuelles : {week, day, kind: 'moved', date} ou {week, day, kind: 'skipped'}.
  overrides  jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table week_plan enable row level security;
drop policy if exists app_all on week_plan;
create policy app_all on week_plan for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on week_plan to anon, authenticated;
