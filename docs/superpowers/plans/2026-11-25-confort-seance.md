# Confort de séance et finitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** − / + en séance, glisser entre exercices, anneau de progression, calendrier du mois, transition d'onglets ; autocritique ; README.
**Spec:** `docs/superpowers/specs/2026-11-25-confort-seance-design.md`

## Global Constraints
- Pas de nouveaux tests ; vérif `npx tsc --noEmit -p .`, `npx eslint src`, `npx vitest run` (adapter au minimum).
- Couches ESLint ; français ; tokens `src/ui/tokens.css` ; animations coupées si `data-reduce-motion` / `prefers-reduced-motion`.
- Pas kg 0,5, reps 1 ; jamais < 0 kg ni < 1 rep. Glisser : 60 px, ratio 1,5, bords 24 px.
- Ne pas lire `.env*` ; ne pas toucher `.idea/`, `android/.kotlin/`.

## Review Focus
- Saisie au clavier toujours possible ; arrondi des flottants (62,5 + 0,5 = 63, pas 63.0000001).
- Glisser en séance ne déclenche pas pendant la saisie ni dans les feuilles (Mes records, état).
- Calendrier : mois sans séance, fuseau local (pas de décalage d'un jour).

### Task 1: Séance — − / +, glisser entre exercices, anneau
**Files:** `src/features/workout/*`, éventuellement `src/ui` (Stepper, ProgressRing réutilisables), `src/domain/numbers.ts` si besoin d'arrondi.
- [ ] Spec §1–3. Commit `feat(séance): boutons − / +, glisser entre exercices, anneau de progression`.

### Task 2: Calendrier du mois et transition d'onglets
**Files:** `src/features/home/*` (+ helper pur dans `homeLogic.ts`), `src/app/Layout.tsx`, `src/ui` (styles de transition).
- [ ] Spec §4–5. Commit `feat(accueil): calendrier du mois, transition entre onglets`.
