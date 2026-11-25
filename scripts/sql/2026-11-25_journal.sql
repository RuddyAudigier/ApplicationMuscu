-- 2026-11-25 — Journal : comptes rendus de séance (état, échauffements), notes de bloc, catalogue d'échauffements.
-- Migration ADDITIVE et IDEMPOTENTE : rejouable sans risque.
-- Tant qu'elle n'est pas jouée, l'app garde le journal dans le localStorage de l'appareil
-- (clé `mymuscle_journal_v1`), sans synchronisation entre appareils.
--
-- À exécuter dans l'éditeur SQL Supabase.

create table if not exists journal (
  id          int primary key default 1 check (id = 1),
  logs        jsonb not null default '[]'::jsonb,
  block_notes jsonb not null default '{}'::jsonb,
  warmups     jsonb not null default '{"catalog":[],"bySession":{}}'::jsonb,
  updated_at  timestamptz default now()
);

alter table journal enable row level security;
drop policy if exists app_all on journal;
create policy app_all on journal for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on journal to anon, authenticated;

-- Ligne unique (évite une réponse 406 « aucune ligne » avant la première sauvegarde).
insert into journal (id) values (1) on conflict (id) do nothing;
