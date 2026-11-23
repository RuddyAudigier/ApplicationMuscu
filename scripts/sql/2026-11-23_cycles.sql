-- 2026-11-23 — Méthode fontesque : cycles A/B.
-- Migration ADDITIVE et IDEMPOTENTE : rejouable sans risque, ne supprime ni ne modifie aucune donnée.
-- Tant qu'elle n'est pas jouée, l'app enregistre le cycle des séances et l'état du cycle en cours
-- dans le localStorage de l'appareil (clé `mymuscle_cycles_v1`), sans synchronisation entre appareils.
--
-- À exécuter dans l'éditeur SQL Supabase.
-- Si la RLS est activée sur `cycle_state`, ajouter des politiques équivalentes à celles des
-- autres tables (lecture + insert + update), sinon l'app recevra une erreur 42501.

-- Cycle (A ou B) d'une séance ; NULL = séance hors cycle (séances existantes).
alter table sessions add column if not exists cycle text check (cycle in ('A','B'));

-- État du cycle en cours (ligne unique id = 1).
create table if not exists cycle_state (
  id int primary key default 1 check (id = 1),
  current text not null check (current in ('A','B')),
  started_on date not null,
  weeks int not null check (weeks in (2,3)),
  updated_at timestamptz default now()
);
