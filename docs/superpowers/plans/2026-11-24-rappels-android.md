# Rappels Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notifications locales sur l'APK : séance du jour (heure unique) et veille de bascule de cycle.

**Architecture:** Calcul pur des rappels dans `domain/reminders.ts` ; programmation Capacitor isolée dans `platform/notifications.ts` ;
un hook de synchronisation (feature settings) reprogramme dès que plan, cycle, séances, perfs ou réglages changent ; section « Rappels » dans Réglages.

**Tech Stack:** React 19, TanStack Query, Capacitor 8, `@capacitor/local-notifications`.

**Spec:** `docs/superpowers/specs/2026-11-24-rappels-android-design.md`

## Global Constraints

- Pas de nouveaux tests (demande explicite de l'utilisateur) : vérification par `tsc`, `eslint`, suite existante, essai sur l'APK.
- Couches ESLint : `platform` n'importe que `domain` et `@capacitor/*` ; `features` peut importer `platform`, `data`, `domain`, `ui`.
- Textes exacts : titre séance « Cycle A · Haut du corps » ; corps « 5 exercices · 14 séries · semaine 1 sur 2 » ;
  dépliée « Développé couché · Tractions · … » + saut de ligne + « 14 séries prévues · semaine 1 sur 2 » ; action « Démarrer la séance ».
  Bascule : « Demain : début du cycle B » ; « Bloc A terminé · 6 séances · 9 PR » ; dépliée + « Prépare ton bilan pour le coach. ».
- Icône `ic_stat_mymuscle` (haltère blanc), `iconColor` `#d4f53c` ; groupe `mymuscle` ; canaux `seances` « Séances », `cycles` « Cycles ».
- Réglages défaut : activé = false tant que l'utilisateur n'a pas accepté la permission ; heure `08:00`. Fenêtre : 28 jours.
- Web (non natif) : aucune notification, section Réglages masquée.

## Review Focus

- Séance déjà faite aujourd'hui (même en avance) : pas de rappel ce jour-là.
- Heure déjà passée aujourd'hui : pas de rappel aujourd'hui, les jours suivants oui.
- Séance décalée ou sautée cette semaine : rappel à la nouvelle date / aucun rappel.
- Permission refusée : l'interrupteur revient à « désactivé » avec un message, aucune erreur.
- Rappels désactivés : toutes les notifications en attente de l'app sont annulées.

---

### Task 1: Calcul des rappels (domaine)

**Files:**
- Create: `src/domain/reminders.ts`

**Interfaces:**
- Consumes: `weekOccurrences`, `mondayOf`, `addDays` (`domain/planning`), `cycleStatus`, `currentBlock` (`domain/cycles`), `latestPrs` (`domain/records`), `parseDateToIso` (`domain/dates`).
- Produces:
  ```ts
  export interface Reminder { id: number; kind: 'session' | 'switch'; date: IsoDate; title: string; body: string; largeBody: string }
  export function planReminders(input: {
    plan: WeekPlan; sessions: Session[]; cycleState: CycleState; perfs: Performance[];
    today: IsoDate; nowMinutes: number; timeMinutes: number; days?: number /* 28 */;
  }): Reminder[]
  ```
- [ ] Séances : pour chaque lundi de `mondayOf(today)` à `today + days`, `weekOccurrences(plan, sessions, cycleState, perfs, w === mondayOf(today) ? today : w)` ; garder statut `today`/`upcoming`, date dans `[today, today+days)`, et pas aujourd'hui si `nowMinutes >= timeMinutes`.
- [ ] Bascule : une seule, la veille de `today + cycleStatus(...).daysLeft` si dans la fenêtre (mêmes règles d'heure). Compteurs sur `[currentBlock.startedOn, today]` : séances = couples (date, nom de séance) distincts ; PR = `latestPrs(perfs, Infinity)` filtrés sur la plage.
- [ ] `id` = `yyyymmdd * 10 + rang du jour` (séances 0–8, bascule 9).
- [ ] `npx tsc --noEmit -p .` et `npx eslint src/domain` OK ; commit `feat(domain): calcul des rappels`.

### Task 2: Plugin et programmation (platform + Android)

**Files:**
- Modify: `package.json` (`@capacitor/local-notifications@^8`), `android/` via `npx cap sync android`
- Create: `android/app/src/main/res/drawable/ic_stat_mymuscle.xml` (vector haltère blanc 24 dp)
- Create: `src/platform/notifications.ts`

**Interfaces:**
- Consumes: `Reminder` (Task 1).
- Produces:
  ```ts
  export interface ReminderPrefs { enabled: boolean; time: string /* 'HH:mm' */ }
  export const REMINDER_PREFS_EVENT = 'mymuscle:reminder-prefs';
  export function loadReminderPrefs(): ReminderPrefs;              // localStorage 'reminder_prefs_v1', tolérant
  export function saveReminderPrefs(p: ReminderPrefs): void;       // + dispatch REMINDER_PREFS_EVENT
  export function remindersAvailable(): boolean;                   // isNative()
  export function requestReminderPermission(): Promise<boolean>;
  export function syncReminders(reminders: Reminder[], time: string): Promise<void>; // annule les en attente puis programme
  export function useReminderTap(open: () => void): void;          // listener 'localNotificationActionPerformed'
  ```
- [ ] `syncReminders` : crée les canaux et le type d'action `session` (bouton `start` « Démarrer la séance ») une fois ; sans permission → annule et sort ; `schedule.at` = date locale + heure, `allowWhileIdle: true` ; `smallIcon`, `iconColor`, `group`, `channelId` selon `kind`, `actionTypeId: 'session'` pour les séances.
- [ ] tsc + eslint OK ; commit `feat(platform): notifications locales`.

### Task 3: Synchronisation et Réglages

**Files:**
- Create: `src/features/settings/useReminderSync.ts`, export dans `src/features/settings/index.ts`
- Modify: `src/features/settings/SettingsScreen.tsx` (section « Rappels »), `src/app/Layout.tsx` (appel du hook + `useReminderTap(() => navigate('/'))`)
- Modify: `README.md` (Réglages, Android)

**Interfaces:**
- Consumes: Tasks 1–2, `useWeekPlan`, `useSessions`, `useCycleState`, `usePerformances`.
- Produces: `useReminderSync(): void`.
- [ ] Hook : no-op hors natif ; recalcule `planReminders` quand les données (toutes chargées) ou les préférences (événement) changent, et au retour au premier plan (`App` `resume` non requis : remontage suffit) ; désactivé → `syncReminders([], time)`.
- [ ] Réglages : interrupteur « Rappel de séance » (activation → `requestReminderPermission`, refus → toast « Notifications refusées : autorise-les dans les paramètres Android. ») et champ heure (`<Field type="time">`), texte d'aide « Rappel de séance et veille de bascule, d'après ta semaine type. ».
- [ ] tsc, eslint, `npx vitest run` OK ; commit et push `feat: rappels Android`.
