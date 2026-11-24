-- 2026-11-24 — Planning de la semaine (jours d'entraînement, décalages et sauts ponctuels).
-- Migration ADDITIVE et IDEMPOTENTE : rejouable sans risque.
-- Tant qu'elle n'est pas jouée, l'app garde le planning dans le localStorage de l'appareil
-- (clé `mymuscle_week_plan_v1`), sans synchronisation entre appareils.
--
-- À exécuter dans l'éditeur SQL Supabase.

create table if not exists week_plan (
  id         int primary key default 1 check (id = 1),
  -- Une semaine type par cycle : {"A": [7 valeurs], "B": [7 valeurs]}, lundi → dimanche,
  -- id de la séance du cycle ou null (repos). L'ancien format (tableau) est lu comme vide.
  days       jsonb not null default '{"A":[null,null,null,null,null,null,null],"B":[null,null,null,null,null,null,null]}'::jsonb,
  -- Exceptions ponctuelles : {week, day, kind: 'moved', date} ou {week, day, kind: 'skipped'}.
  overrides  jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table week_plan enable row level security;
drop policy if exists app_all on week_plan;
create policy app_all on week_plan for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on week_plan to anon, authenticated;

-- Ancien format (une semaine commune aux deux cycles) : remis à vide, une semaine par cycle.
update week_plan
   set days = '{"A":[null,null,null,null,null,null,null],"B":[null,null,null,null,null,null,null]}'::jsonb
 where jsonb_typeof(days) = 'array';
alter table week_plan alter column days
  set default '{"A":[null,null,null,null,null,null,null],"B":[null,null,null,null,null,null,null]}'::jsonb;

-- Ligne unique (évite une réponse 406 « aucune ligne » avant le premier réglage).
insert into week_plan (id) values (1) on conflict (id) do nothing;
