-- 2026-11-25 — Durée des cycles réglable (1 à 4 semaines) et report du prochain cycle.
-- Migration ADDITIVE et IDEMPOTENTE : rejouable sans risque. Les anciennes lignes (weeks = 2 ou 3)
-- sont conservées : la durée passe à 14 jours et la 3e semaine devient un report de 7 jours.
-- Tant qu'elle n'est pas jouée, l'app garde l'état du cycle sur l'appareil (clé `mymuscle_cycles_v1`).
--
-- À exécuter dans l'éditeur SQL Supabase (après 2026-11-23_cycles.sql).

-- `weeks` reste écrit (⌈jours du bloc / 7⌉) pour compatibilité, mais n'est plus limité à 2 ou 3.
alter table cycle_state drop constraint if exists cycle_state_weeks_check;

-- Durée générale d'un bloc, en jours.
alter table cycle_state add column if not exists length_days int not null default 14
  check (length_days between 7 and 28);

-- Jours de report ajoutés au seul bloc en cours (par pas de 7).
alter table cycle_state add column if not exists extra_days int not null default 0
  check (extra_days >= 0);

-- Anciennes lignes prolongées à 3 semaines : 7 jours de report.
update cycle_state set extra_days = 7 where weeks = 3 and extra_days = 0 and length_days = 14;
