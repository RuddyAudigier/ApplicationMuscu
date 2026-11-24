-- =====================================================================
-- MyMuscle — RÉINITIALISATION COMPLÈTE de la base Supabase
-- =====================================================================
-- ⚠ DESTRUCTIF : supprime TOUTES les tables de l'application et leurs
--   données, puis recrée le schéma attendu par l'app (branche `rewrite`)
--   et injecte l'historique connu.
--
-- À exécuter en une fois dans Supabase > SQL Editor, sur un projet neuf
-- ou sur un projet dont les données peuvent être perdues.
-- Faire un export avant si la base contient encore des données utiles.
--
-- Données injectées (seules données réelles présentes dans le dépôt) :
--   - historique « Cycle 1 : Bas du corps » (ancien fichier
--     imports/cycle1_bas_du_corps_historique.csv, 39 séries, février 2026) ;
--   - référence triceps 13 × 12,5 kg du 07/02/2026
--     (ancien scripts/sql/repair_triceps_baseline_13x12_5.sql) ;
--   - séance « Cycle 2 : Haut du corps » (ancien SQL_FINAL_CYCLE2.sql),
--     sans historique : aucun export n'existe dans le dépôt.
-- Pour ajouter d'autres performances : Records > ⋯ > Import CSV dans l'app.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Suppression
-- ---------------------------------------------------------------------
drop view  if exists exercises_with_muscles cascade;
drop table if exists performances       cascade;
drop table if exists session_exercises  cascade;
drop table if exists sessions           cascade;
drop table if exists coach_notes        cascade;
drop table if exists exercise_variants  cascade;
drop table if exists muscle_groups      cascade;
drop table if exists exercises          cascade;
drop table if exists general_advice     cascade;
drop table if exists cycle_state        cascade;
drop table if exists shared_sessions    cascade;

-- ---------------------------------------------------------------------
-- 2. Schéma
-- ---------------------------------------------------------------------
create table exercises (
  id          uuid primary key default gen_random_uuid(),
  name        varchar(255) not null,
  description text,
  is_custom   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table muscle_groups (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null references exercises(id) on delete cascade,
  muscle_group varchar(100) not null,
  created_at   timestamptz default now()
);

create table exercise_variants (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  name        varchar(150) not null,
  is_default  boolean not null default false,
  created_at  timestamptz default now()
);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  name       varchar(255) not null,
  cycle      text check (cycle in ('A','B')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table session_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  exercise_id  uuid not null references exercises(id) on delete cascade,
  series_count integer not null default 3,
  position     integer,
  created_at   timestamptz default now()
);

-- Performances : RESTRICT (et non CASCADE) pour qu'une suppression
-- d'exercice ou de variante ne puisse jamais effacer l'historique.
create table performances (
  id               uuid primary key default gen_random_uuid(),
  exercise_id      uuid not null references exercises(id) on delete restrict,
  exercise_name    varchar(255) not null,
  session_name     varchar(255),
  variant_id       uuid references exercise_variants(id) on delete restrict,
  variant_name     varchar(150) not null default 'Touch and Go',
  reps             integer not null check (reps >= 0),
  weight           numeric(10,2) check (weight is null or weight >= 0),
  rpe              integer check (rpe is null or rpe between 6 and 10),
  series_number    integer not null,
  performance_date date not null,
  created_at       timestamptz default now()
);

create table coach_notes (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  notes       text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table general_advice (
  id              smallint primary key check (id = 1),
  training_notes  text not null default '',
  nutrition_notes text not null default '',
  sleep_notes     text not null default '',
  updated_at      timestamptz not null default now()
);

create table cycle_state (
  id         int primary key default 1 check (id = 1),
  current    text not null check (current in ('A','B')),
  started_on date not null,
  weeks      int not null check (weeks in (2,3)),
  updated_at timestamptz default now()
);

create index idx_muscle_groups_exercise_id     on muscle_groups(exercise_id);
create index idx_exercise_variants_exercise_id on exercise_variants(exercise_id);
create index idx_session_exercises_session_id  on session_exercises(session_id);
create index idx_session_exercises_exercise_id on session_exercises(exercise_id);
create index idx_performances_exercise_id      on performances(exercise_id);
create index idx_performances_variant_id       on performances(variant_id);
create index idx_performances_date             on performances(performance_date);
create index idx_coach_notes_exercise_id       on coach_notes(exercise_id);

create view exercises_with_muscles with (security_invoker = true) as
select
  e.id, e.name, e.description, e.is_custom, e.created_at,
  array_remove(array_agg(distinct mg.muscle_group order by mg.muscle_group), null) as muscle_groups
from exercises e
left join muscle_groups mg on mg.exercise_id = e.id
group by e.id, e.name, e.description, e.is_custom, e.created_at;

-- ---------------------------------------------------------------------
-- 3. Sécurité (RLS)
-- L'app n'a pas de connexion utilisateur : elle utilise la clé anon.
-- Ces politiques donnent donc l'accès complet à quiconque possède la clé
-- anon. Ne jamais publier cette clé (voir README, « Sécurité »).
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['exercises','muscle_groups','exercise_variants','sessions',
                           'session_exercises','performances','coach_notes',
                           'general_advice','cycle_state']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy app_all on %I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to anon, authenticated', t);
  end loop;
end $$;
grant select on exercises_with_muscles to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Données
-- ---------------------------------------------------------------------
insert into general_advice (id) values (1);

-- Cycle en cours : A, démarré aujourd'hui, 2 semaines (modifiable dans Réglages).
insert into cycle_state (id, current, started_on, weeks) values (1, 'A', current_date, 2);

-- Exercices et muscles (noms du catalogue de l'app).
create temp table _ex (name text, muscles text[]) on commit drop;
insert into _ex values
  -- Cycle 1 : bas du corps
  ('SDT jambe tendu',                 array['Ischio-jambiers','Fessiers','Bas du dos']),
  ('Fentes bulgares',                 array['Quadriceps','Fessiers']),
  ('Wrist curl',                      array['Avant-bras']),
  ('Leg curl allongé',                array['Ischio-jambiers']),
  ('Hip adduction',                   array['Abducteurs']),
  ('Calf raises',                     array['Mollets']),
  ('Tibial raises',                   array['Mollets']),
  ('Cat cow',                         array['Bas du dos','Abdominaux']),
  -- Cycle 2 : haut du corps
  ('Développé couché',                array['Pectoraux','Triceps','Épaules']),
  ('Tractions',                       array['Grand dorsal','Biceps']),
  ('Élévations latérales',            array['Épaules']),
  ('Flexions biceps',                 array['Biceps']),
  ('Extension triceps poulie basse',  array['Triceps']);

insert into exercises (name, is_custom) select name, true from _ex;
insert into muscle_groups (exercise_id, muscle_group)
select e.id, unnest(x.muscles) from _ex x join exercises e on e.name = x.name;

-- Variante par défaut « Touch and Go » (affichée « Classique ») pour chaque exercice.
insert into exercise_variants (exercise_id, name, is_default)
select id, 'Touch and Go', true from exercises;

-- Historique (exercice, variante, reps, kg, rpe, date, séance).
create temp table _perf (ex text, variant text, reps int, weight numeric, rpe int, d date, session text) on commit drop;
insert into _perf values
  ('SDT jambe tendu','Touch and Go',5,75,10,'2026-02-08','Historique Cycle 1'),
  ('SDT jambe tendu','Touch and Go',7,70,10,'2026-02-28','Historique Cycle 1'),
  ('SDT jambe tendu','Touch and Go',9,65,10,'2026-02-08','Historique Cycle 1'),
  ('SDT jambe tendu','Touch and Go',10,62.5,10,'2026-02-08','Historique Cycle 1'),
  ('SDT jambe tendu','Touch and Go',17,55,10,'2026-02-28','Historique Cycle 1'),
  ('Fentes bulgares','Cible les fessiers',7,22,10,'2026-02-06','Historique Cycle 1'),
  ('Fentes bulgares','Cible les fessiers',9,16,10,'2026-02-06','Historique Cycle 1'),
  ('Fentes bulgares','Cible les quadriceps',7,18,10,'2026-02-28','Historique Cycle 1'),
  ('Fentes bulgares','Cible les quadriceps',10,14,10,'2026-02-28','Historique Cycle 1'),
  ('Fentes bulgares','Cible les quadriceps',12,10,10,'2026-02-28','Historique Cycle 1'),
  ('Wrist curl','Touch and Go',8,27,10,'2026-02-28','Historique Cycle 1'),
  ('Wrist curl','Touch and Go',11,22.5,10,'2026-02-28','Historique Cycle 1'),
  ('Wrist curl','Touch and Go',13,20.3,10,'2026-02-28','Historique Cycle 1'),
  ('Wrist curl','Touch and Go',15,11.3,10,'2026-02-08','Historique Cycle 1'),
  ('Leg curl allongé','Touch and go et hanche mobile',10,41,10,'2026-02-06','Historique Cycle 1'),
  ('Leg curl allongé','Touch and go et hanche mobile',12,36,10,'2026-02-06','Historique Cycle 1'),
  ('Leg curl allongé','Touch and go et hanche fixe',5,41,10,'2026-02-08','Historique Cycle 1'),
  ('Leg curl allongé','Touch and go et hanche fixe',7,36,10,'2026-02-08','Historique Cycle 1'),
  ('Leg curl allongé','Touch and go et hanche fixe',10,32,10,'2026-02-28','Historique Cycle 1'),
  ('Leg curl allongé','Touch and go et hanche fixe',11,29.3,10,'2026-02-28','Historique Cycle 1'),
  ('Hip adduction','Touch and Go',5,54.3,10,'2026-02-08','Historique Cycle 1'),
  ('Hip adduction','Touch and Go',7,52,10,'2026-02-28','Historique Cycle 1'),
  ('Hip adduction','Touch and Go',10,49.6,10,'2026-02-08','Historique Cycle 1'),
  ('Hip adduction','Touch and Go',11,47.3,10,'2026-02-08','Historique Cycle 1'),
  ('Hip adduction','Touch and Go',12,41.3,10,'2026-02-06','Historique Cycle 1'),
  ('Hip adduction','Touch and Go',17,34.3,10,'2026-02-06','Historique Cycle 1'),
  ('Hip adduction','Hold',17,39,10,'2026-02-28','Historique Cycle 1'),
  ('Calf raises','Touch and Go',12,45,10,'2026-02-06','Historique Cycle 1'),
  ('Calf raises','Touch and Go',15,39,10,'2026-02-06','Historique Cycle 1'),
  ('Calf raises','Pausé 2.0.2.0',8,73,10,'2026-02-28','Historique Cycle 1'),
  ('Calf raises','Pausé 2.0.2.0',10,61.3,10,'2026-02-28','Historique Cycle 1'),
  ('Tibial raises','Touch and Go',6,8,10,'2026-02-08','Historique Cycle 1'),
  ('Tibial raises','Touch and Go',12,4,10,'2026-02-08','Historique Cycle 1'),
  ('Tibial raises','Tempo 2.3.2.3',4,8,10,'2026-02-28','Historique Cycle 1'),
  ('Tibial raises','Tempo 2.3.2.3',10,4,10,'2026-02-28','Historique Cycle 1'),
  ('Cat cow','Touch and Go',8,30,10,'2026-02-06','Historique Cycle 1'),
  ('Cat cow','Pause 2.0.2.0',6,30,10,'2026-02-08','Historique Cycle 1'),
  ('Cat cow','Pause 2.0.2.0',8,25,10,'2026-02-08','Historique Cycle 1'),
  ('Cat cow','Pause 2.0.2.0',10,22.5,10,'2026-02-28','Historique Cycle 1'),
  ('Extension triceps poulie basse','Touch and Go',13,12.5,10,'2026-02-07','Historique Cycle 1');

-- Variantes supplémentaires rencontrées dans l'historique.
insert into exercise_variants (exercise_id, name, is_default)
select distinct e.id, p.variant, false
from _perf p join exercises e on e.name = p.ex
where lower(p.variant) <> 'touch and go';

insert into performances
  (exercise_id, exercise_name, session_name, variant_id, variant_name,
   reps, weight, rpe, series_number, performance_date, created_at)
select
  e.id, e.name, p.session, v.id, v.name,
  p.reps, p.weight, p.rpe,
  row_number() over (partition by p.ex, p.d order by p.reps),
  p.d, p.d::timestamptz + interval '12 hours'
from _perf p
join exercises e on e.name = p.ex
join exercise_variants v on v.exercise_id = e.id and lower(v.name) = lower(p.variant);

-- Séances : Cycle 1 (bas du corps) → A, Cycle 2 (haut du corps) → B.
-- Modifiable dans l'app (Programme).
with s as (
  insert into sessions (name, cycle) values ('Cycle 1 : Bas du corps', 'A') returning id
)
insert into session_exercises (session_id, exercise_id, series_count, position)
select s.id, e.id, 3, x.pos
from s
join (values ('SDT jambe tendu',1),('Fentes bulgares',2),('Leg curl allongé',3),('Hip adduction',4),
             ('Calf raises',5),('Tibial raises',6),('Wrist curl',7),('Cat cow',8)) as x(name,pos) on true
join exercises e on e.name = x.name;

with s as (
  insert into sessions (name, cycle) values ('Cycle 2 : Haut du corps', 'B') returning id
)
insert into session_exercises (session_id, exercise_id, series_count, position)
select s.id, e.id, x.series, x.pos
from s
join (values ('Développé couché',4,1),('Tractions',3,2),('Élévations latérales',3,3),
             ('Flexions biceps',3,4),('Extension triceps poulie basse',3,5)) as x(name,series,pos) on true
join exercises e on e.name = x.name;

commit;

-- Vérification
select
  (select count(*) from exercises)         as exercices,
  (select count(*) from exercise_variants) as variantes,
  (select count(*) from performances)      as performances,
  (select count(*) from sessions)          as seances;
