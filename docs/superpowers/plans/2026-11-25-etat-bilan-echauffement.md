# État du jour, bilan de bloc, échauffements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Forme/état dans le compte rendu, échauffements (général + chauffe), bilan de bloc avec PDF.

**Architecture:** Modèle `Journal` (domaine) stocké en singleton jsonb `journal` (data, repli localStorage) ; état et chauffe portés par `WorkoutState` puis par `Report` ; écran `/bilan` calculé en pur dans `domain/blockReview.ts`.

**Tech Stack:** React 19, TanStack Query, zod, Supabase, jsPDF (`src/platform/pdf.ts`).

**Spec:** `docs/superpowers/specs/2026-11-25-etat-bilan-echauffement-design.md`

## Global Constraints

- Pas de nouveaux tests ; vérif : `npx tsc --noEmit -p .`, `npx eslint src`, `npx vitest run` (adapter au minimum un test existant cassé).
- Couches : domain → domain ; data → domain ; platform → domain + @capacitor ; features → domain/data/ui/platform, autres features par index ; app → tout.
- États par exercice (ordre, libellés exacts) : `fatigue` « Fatigué », `motive` « Motivé », `energique` « Énergique », `mou` « Mou ». Forme : `frais` « Frais », `fatigue` « Fatigué ».
- Fatigué au démarrage : séries prévues − 1, minimum 1.
- Séries de chauffe jamais envoyées comme performances ni classées PR.
- Libellés : « Échauffement », « Série de chauffe », « Chauffe : 10 × 40 kg, 5 × 60 kg », « État général », « Forme du jour », « Bilan du bloc », « Ressenti du bloc ».
- Écritures en ligne uniquement (pattern `requireOnline` existant) ; jamais lire `.env*`.

## Review Focus

- Ancien `WorkoutState` / `Report` en localStorage (sans les nouveaux champs) : se recharge sans erreur (champs par défaut).
- Table `journal` absente : repli localStorage, un seul avertissement, pas de chargement infini.
- Modification du compte rendu hors ligne : toast d'erreur, données locales conservées.
- Bloc sans séance ni semaine type : bilan affiché avec des zéros, pas de plantage.
- Séance supprimée après coup : son choix d'échauffements ignoré sans erreur.

---

### Task 1: Modèle et stockage du journal

**Files:** Create `src/domain/journal.ts`, `src/data/shared/journal.ts`, `src/data/supabase/journal.repo.ts`, `src/data/mock/journal.repo.ts`, `src/data/queries/journal.ts`, `scripts/sql/2026-11-25_journal.sql` ; Modify `src/data/ports.ts`, `src/data/{supabase,mock}/index.ts`, `src/data/mock/{db,seed}.ts`, `src/data/queries/{keys,index}.ts`, `scripts/sql/reset_complet.sql`, `README.md` (migration).

**Interfaces (Produces):**
```ts
// domain/journal.ts
export type Form = 'frais' | 'fatigue';
export const FEELINGS = [{ id: 'fatigue', label: 'Fatigué' }, { id: 'motive', label: 'Motivé' }, { id: 'energique', label: 'Énergique' }, { id: 'mou', label: 'Mou' }] as const;
export type Feeling = (typeof FEELINGS)[number]['id'];
export interface WarmupItem { id: Id; name: string; detail: string }
export interface WarmupSet { reps: number; weight: number | null }
export interface SessionLog {
  id: Id; date: IsoDate; sessionId: Id | null; sessionName: string; cycle: CycleId | null;
  form: Form | null; mood: string;
  exercises: { exerciseId: Id; name: string; feeling: Feeling | null; warmupSets: WarmupSet[] }[];
  warmupDone: { name: string; detail: string }[];
}
export interface Journal { logs: SessionLog[]; blockNotes: Record<IsoDate, string>; warmups: { catalog: WarmupItem[]; bySession: Record<Id, Id[]> } }
export const emptyJournal: () => Journal;
export function upsertLog(j: Journal, log: SessionLog): Journal;
export function setBlockNote(j: Journal, blockStart: IsoDate, note: string): Journal;
// ports: JournalRepo { get(): Promise<Journal | null>; save(j: Journal): Promise<void> }, DataBackend.journal
// queries: useJournal(): UseQueryResult<Journal | null>; useSaveJournal(): UseMutationResult<void, Error, Journal> (requireOnline, setQueryData + invalidate, comme weekPlan)
```
- [ ] SQL : `create table if not exists journal (id int primary key default 1 check (id = 1), logs jsonb not null default '[]', block_notes jsonb not null default '{}', warmups jsonb not null default '{"catalog":[],"bySession":{}}', updated_at timestamptz default now())`, RLS `app_all` + grants anon/authenticated, `insert … (1) on conflict do nothing` ; même bloc dans `reset_complet.sql` (drop + create + row).
- [ ] zod tolérant (`parseJournal`) : champs invalides → défauts ; repli localStorage clé `mymuscle_journal_v1` (copie exacte du pattern `weekPlan.repo.ts`).
- [ ] Vérif ; commit `feat(data): journal (état, échauffements, notes de bloc)`.

### Task 2: État du jour en séance et dans le compte rendu

**Files:** Modify `src/domain/workout.ts` (WorkoutState : `form: Form | null`, `mood: string` ; WorkoutExercise : `feeling: Feeling | null` ; actions `setForm`, `setMood`, `setFeeling` ; `startWorkout(session, exercises, now, form?: Form)` appliquant −1 si fatigué ; parse tolérant des anciens états), `src/domain/report.ts` (Report : `form`, `mood`, `logId`, exercices `feeling`), `src/features/workout/*`, `src/features/report/*`, démarrage depuis `src/features/home` et `src/features/program` (feuille Frais/Fatigué avant `startWorkout`), `src/platform/pdf.ts` si le modèle doit porter un bloc de texte.

**Interfaces:** Consumes Task 1 (`Form`, `Feeling`, `FEELINGS`, `SessionLog`, `upsertLog`, `useJournal`, `useSaveJournal`). Produces `logFromWorkout(state: WorkoutState, id: Id): SessionLog` dans `domain/journal.ts` (réutilisé Task 3).
- [ ] Séance : sous l'en-tête, champ « État général » repliable ; par exercice, puces des 4 états (une seule active, re-toucher = aucune).
- [ ] Terminer : en plus de l'existant, `useSaveJournal` avec `upsertLog(journal, logFromWorkout(state, id))` (id `crypto.randomUUID()`, stocké dans le Report) ; échec → toast « État non synchronisé : il reste dans ce compte rendu. » sans bloquer la navigation.
- [ ] Compte rendu : section « Forme du jour » (segmenté), « État général » (texte), état par exercice (puces) ; chaque modification met à jour le Report local (`saveLastReport`) et le journal ; PDF : lignes « Forme du jour : Frais », « État général : … », état à côté de chaque exercice.
- [ ] Vérif ; commit `feat: état du jour dans la séance et le compte rendu`.

### Task 3: Échauffements

**Files:** Modify `src/domain/workout.ts` (`warmup: { name; detail; done: boolean }[]` sur WorkoutState, `warmupSets: { reps: string; kg: string }[]` sur WorkoutExercise, actions `toggleWarmup`, `addWarmupSet`, `setWarmupSet`, `removeWarmupSet` ; `startWorkout` reçoit les échauffements de la séance), `src/domain/journal.ts` (`logFromWorkout` remplit `warmupDone`/`warmupSets`), `src/domain/report.ts` (Report : `warmup`, exercices `warmupSets`), `src/features/program/*` (gestion du catalogue « Échauffements » et sélection dans `SessionBuilder`, enregistrée dans `journal.warmups.bySession`), `src/features/workout/*`, `src/features/report/*`, PDF.

**Interfaces:** Consumes Tasks 1–2.
- [ ] Programme : section « Échauffements » (liste, ajouter/modifier/supprimer nom + détail) ; constructeur de séance : choix ordonné parmi le catalogue.
- [ ] Séance : bloc « Échauffement » en tête (cases à cocher) si la séance en a ; par exercice, bouton « + Série de chauffe » et lignes reps × kg supprimables, au-dessus des séries de travail, style atténué.
- [ ] Compte rendu + PDF : section « Échauffement » (faits) ; sous chaque exercice « Chauffe : 10 × 40 kg, 5 × 60 kg ».
- [ ] Les séries de chauffe ne sont jamais dans `inputs` envoyés à `addPerformances` ni dans `buildReport` PR.
- [ ] Vérif ; commit `feat: échauffement général et séries de chauffe`.

### Task 4: Bilan de bloc

**Files:** Create `src/domain/blockReview.ts`, `src/features/review/` (`ReviewScreen.tsx`, css, `index.ts`) ; Modify `src/app/router.tsx` (`/bilan`), `src/features/home/*` (carte « Bilan du bloc »), `src/platform/pdf.ts` si besoin, `README.md`.

**Interfaces:** Consumes Task 1 + `cycleStatus`/`currentBlock`/`timeline` (cycles), `weekOccurrences` (planning), `latestPrs` (records).
```ts
export interface BlockRange { cycle: CycleId; start: IsoDate; end: IsoDate /* inclus */ }
export function recentBlocks(state: CycleState, today: IsoDate, count = 6): BlockRange[]; // en cours d'abord
export function blockReview(input: { block: BlockRange; today: IsoDate; plan: WeekPlan | null; sessions: Session[]; cycleState: CycleState; perfs: Performance[]; journal: Journal }): {
  sessionsDone: number; sessionsPlanned: number; sessionsSkipped: number;
  prs: RecentPr[]; exercisesWithoutPr: string[];
  forms: Record<Form, number>; feelings: { exercise: string; counts: Partial<Record<Feeling, number>> }[];
  moods: { date: IsoDate; sessionName: string; mood: string }[];
}
```
- [ ] Blocs passés : reconstitués en reculant de 14 jours depuis le début du bloc en cours (approximation documentée : l'historique des prolongations n'est pas stocké).
- [ ] Écran : sélecteur de bloc, chiffres clés, listes, « Ressenti du bloc » (textarea enregistrée via `setBlockNote` + `useSaveJournal`), bouton « Exporter en PDF » (partage comme le compte rendu).
- [ ] Accueil : carte « Bilan du bloc » (accent si ≤ 3 jours avant la bascule) → `/bilan`.
- [ ] Vérif ; commit `feat: bilan de bloc`.
