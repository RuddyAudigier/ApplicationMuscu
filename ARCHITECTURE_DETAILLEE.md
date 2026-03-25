# 🎨 ARCHITECTURE DÉTAILLÉE DE LA REFONTE

## Vue d'ensemble: De Desktop-First à Mobile-First Thumb-First

```
╔════════════════════════════════════════════════════════════════════════════╗
║                   ARCHITECTURE ACTUELLE (Desktop-First)                     ║
╚════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────┐
│ 🔝 NAVBAR (Horizontal Top Navigation)                                   │
│ [Logo] [Accueil] [Entraînement] [Performances]                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  .app-content (Main Container - 80% width)                             │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ {currentPage === 'home' && <HomePage />}                      │    │
│  │ {currentPage === 'musculation' && <MusculationPage />}        │    │
│  │ {currentPage === 'runner' && <SessionRunner />}               │    │
│  │ {currentPage === 'performances' && <PerformancesPage />}      │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

❌ PROBLÈMES:
- Navigation au top = mauvais pour accès au pouce
- Main-container limité en width = espace gaspillé sur mobile
- Pas de safe-area pour téléphone (notch, home indicator)
```

---

```
╔════════════════════════════════════════════════════════════════════════════╗
║              ARCHITECTURE CIBLE (Mobile-First Thumb-First)                 ║
╚════════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────┐
│ .app (min-height: 100dvh, display: flex, flex-direction: column)        │
│                                                                          │
│  .app-content (flex: 1, width: 100%, pb: 72px)                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                                                                │    │
│  │  {currentPage === 'home' && <HomePage />}                     │    │
│  │  • StatsSection (3 cards en grid)                            │    │
│  │  • RecentSessions (carousel horizontal)                       │    │
│  │  • FeaturesGrid                                               │    │
│  │                                                                │    │
│  │  {currentPage === 'musculation' && <MusculationPage />}       │    │
│  │  • ExercisesDashboard OR SessionsDashboard                     │    │
│  │  • TabBar sticky en haut                                      │    │
│  │                                                                │    │
│  │  {currentPage === 'runner' && <SessionRunner />}              │    │
│  │  • SessionHeader (exercice actuel, progress bar)              │    │
│  │  • ExerciseWorkoutCard (exercice détails)                     │    │
│  │  • WorkoutInputPanel (inputs LARGES centrés)                  │    │
│  │  • WorkoutActionBar (buttons valider/suivant)                 │    │
│  │                                                                │    │
│  │  {currentPage === 'performances' && <PerformancesPage />}    │    │
│  │  • PR charts, stats                                            │    │
│  │                                                                │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  .bottom-navigation (position: fixed, bottom: 0, width: 100%)          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ [🏠] [📋] [💪] [📊] [⚙️]                                        │    │
│  │ Home  Cycles Workout Perf Settings                             │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

✅ BÉNÉFICES:
- Navigation au bottom = accès facile au pouce
- Contenu full-width = max utilisation de l'écran
- Safe-area padding = respecte notch/home indicator
- Thumb-first = ergonomie optimale salle de sport
```

---

## 📱 Détail de chaque page

### 🏠 PAGE: HomePage

**Avant:**
```
┌────────────────────────────────┐
│ Titre Hero                     │
│ Sous-titre                     │
│ Description long               │
│                                │
│ CTA Button                     │
│                                │
│ [Side Panel] Features          │
│ • Feature 1                    │
│ • Feature 2                    │
│ • Feature 3                    │
│                                │
│ [3 Feature Cards - Grid]       │
│                                │
│ General Advice Board           │
└────────────────────────────────┘
```

**Après (Mobile-First):**
```
┌────────────────────────────────────┐
│ QUICK STATS SECTION                │
│ ┌──────────┐ ┌──────────┐        │
│ │ Sessions │ │ Exercices│        │
│ │   142    │ │   34     │        │
│ └──────────┘ └──────────┘        │
│ ┌──────────────────────────┐      │
│ │ Total Volume This Month  │      │
│ │      847.5 kg            │      │
│ └──────────────────────────┘      │
│                                   │
│ RECENT SESSIONS (Carousel)        │
│ ┌─────────┐ ┌─────────┐           │
│ │Session 1│→│Session 2│→...      │
│ │ Chest   │ │ Legs    │           │
│ │2h ago   │ │4h ago   │           │
│ └─────────┘ └─────────┘           │
│                                   │
│ CTA PRIMAIRE: START WORKOUT      │
│                                   │
│ FEATURES (2x2 Grid)               │
│ ┌──────────┐ ┌──────────┐        │
│ │Feature 1 │ │Feature 2 │        │
│ └──────────┘ └──────────┘        │
│ ┌──────────┐ ┌──────────┐        │
│ │Feature 3 │ │Feature 4 │        │
│ └──────────┘ └──────────┘        │
│                                   │
│ General Advice Board              │
└────────────────────────────────────┘
```

**Composants à créer:**
- `StatsSection.jsx` → 3 stat cards (Glassmorphism)
- `RecentSessionsCarousel.jsx` → Scrollable horizontal list

---

### 💪 PAGE: SessionRunner (Workout Active)

**Avant:**
```
┌────────────────────────────────┐
│ SessionHeader                  │
├────────────────────────────────┤
│ Exercise Info                  │
│ ┌──────────────────────────┐  │
│ │ Exercise Name            │  │
│ │ Variants: [dropdown]     │  │
│ │ Coach Notes              │  │
│ └──────────────────────────┘  │
│                                │
│ Series List (Scrollable)       │
│ ┌──────────────────────────┐  │
│ │ Serie 1 [input] [input]  │  │
│ │ Serie 2 [input] [input]  │  │
│ │ Serie 3 [input] [input]  │  │
│ │ ...                      │  │
│ └──────────────────────────┘  │
│                                │
│ [Valider Serie] [Suivant]     │
└────────────────────────────────┘

❌ Problèmes:
- Inputs petits et nombreux
- Pas de focus clair sur série actuelle
- Interactions nombreuses et confuses
- RPE dropdown pas évident
```

**Après (Thumb-Friendly):**
```
┌────────────────────────────────────┐
│ SESSION HEADER (Sticky)            │
│ Exercise 3/8: Bench Press          │
│ ████████░░ 37.5% Complete         │
├────────────────────────────────────┤
│                                    │
│ EXERCISE WORKOUT CARD              │
│ ┌──────────────────────────────┐  │
│ │ 🏋️ BENCH PRESS               │  │
│ │ Barbell • Incline            │  │
│ │                              │  │
│ │ Sets: 4 • Current: 2/4       │  │
│ │                              │  │
│ │ PR: 120 kg x 5               │  │
│ │ Personal Record! 🎉           │  │
│ └──────────────────────────────┘  │
│                                    │
│ WORKOUT INPUT PANEL (LARGE)        │
│ ┌──────────────────────────────┐  │
│ │ SET 2 / 4                    │  │
│ │                              │  │
│ │ ┌────────────────────────┐   │  │
│ │ │ WEIGHT: [____100__] kg  │   │  │
│ │ └────────────────────────┘   │  │
│ │                              │  │
│ │ ┌────────────────────────┐   │  │
│ │ │ REPS: [____5___]        │   │  │
│ │ └────────────────────────┘   │  │
│ │                              │  │
│ │ RPE: [6] [7] [8] [9] [10]    │  │
│ │       ← Light  →  ← Hard →   │  │
│ │                              │  │
│ │ Coach Note: [____________]   │  │
│ └──────────────────────────────┘  │
│                                    │
│ WORKOUT ACTION BAR                 │
│ ┌──────────────┬──────────────┐   │
│ │ ← Prev Set   │ Next Set →   │   │
│ └──────────────┴──────────────┘   │
│ ┌──────────────────────────────┐  │
│ │ VALIDATE & CONTINUE          │  │
│ └──────────────────────────────┘  │
│                                    │
└────────────────────────────────────┘

✅ Améliorations:
- 1 série visible à la fois
- Inputs ÉNORMES (48px+ touchable)
- RPE buttons interactifs
- Progression claire
- Actions au bottom = accès facile au pouce
```

**Composants à créer:**
- `SessionHeader.jsx` → Exercise name + progress bar
- `ExerciseWorkoutCard.jsx` → Current exercise details
- `WorkoutInputPanel.jsx` → LARGE inputs (weight, reps, RPE, notes)
- `WorkoutActionBar.jsx` → Next/Prev/Validate buttons

**Composants à modifier:**
- `SessionRunner.jsx` → Restructure avec nouveaux composants

---

### 📋 PAGE: MusculationPage (Exercices & Séances)

**Avant:**
```
┌────────────────────────────┐
│ Tabs: [Exercices] [Séances]│
├────────────────────────────┤
│                            │
│ Add Exercise Form (Inline) │
│ SearchBar                  │
│ ExerciseList (Full)        │
│                            │
└────────────────────────────┘
```

**Après:**
```
┌────────────────────────────────┐
│ TAB BAR (Sticky)               │
│ [Exercices] [Séances]          │
├────────────────────────────────┤
│                                │
│ EXERCISES DASHBOARD (if active)│
│ ┌──────────────────────────┐  │
│ │ [+ ADD EXERCISE] Button  │  │
│ └──────────────────────────┘  │
│                                │
│ SearchBar (Large input)        │
│                                │
│ Exercises Grid (2 columns)     │
│ ┌─────────────┐ ┌─────────────┐
│ │ Bench Press │ │ Squat       │
│ │ Chest       │ │ Legs        │
│ │ • 12 sets   │ │ • 8 sets    │
│ └─────────────┘ └─────────────┘
│ ┌─────────────┐ ┌─────────────┐
│ │ Deadlift    │ │ Rows        │
│ │ Back        │ │ Back        │
│ │ • 6 sets    │ │ • 10 sets   │
│ └─────────────┘ └─────────────┘
│                                │
│ SESSIONS DASHBOARD (if active) │
│ ┌──────────────────────────┐  │
│ │ [+ CREATE SESSION]       │  │
│ └──────────────────────────┘  │
│                                │
│ Recent Sessions (Cards)        │
│ ┌──────────────────────────┐  │
│ │ Full Body (5 ex)         │  │
│ │ Last: 3 days ago         │  │
│ │ [Start] [Details]        │  │
│ └──────────────────────────┘  │
│ ┌──────────────────────────┐  │
│ │ Push Day (4 ex)          │  │
│ │ Last: 1 week ago         │  │
│ │ [Start] [Details]        │  │
│ └──────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

---

### 📊 PAGE: PerformancesPage

**Approche:** Cards stats avec graphiques minimalistes

```
┌────────────────────────────────┐
│ PERFORMANCE STATS              │
│                                │
│ ┌──────────────────────────┐  │
│ │ Top Lift (This Month)    │  │
│ │ Bench Press: 120kg       │  │
│ │ +5kg vs last month       │  │
│ └──────────────────────────┘  │
│                                │
│ ┌──────────────────────────┐  │
│ │ Volume Trend             │  │
│ │ [Mini Line Chart]        │  │
│ └──────────────────────────┘  │
│                                │
│ Exercises Breakdown            │
│ ┌──────────────┐              │
│ │ Bench Press  │ ████░ 8 PRs │
│ │ Squat        │ ██████ 12 PRs│
│ │ Deadlift     │ ████░ 6 PRs  │
│ └──────────────┘              │
│                                │
└────────────────────────────────┘
```

---

## 🎨 PALETTE VISUELLE COMPLÈTE

### Couleurs de base

```css
/* Background */
--bg-primary: #0B0B0C        /* OLED Deep Black - page bg */
--bg-secondary: #1C1C1E      /* Charcoal - card bg */
--bg-tertiary: #2C2C2E       /* Dark Gray - hover state */

/* Accents */
--accent-primary: #CCFF00    /* Neon Lime - buttons, focus */
--accent-secondary: #00FFFF  /* Neon Cyan - info, headers */
--accent-danger: #FF3B30     /* Neon Red - RPE 10, errors */

/* Text */
--text-primary: #FFFFFF      /* Main text */
--text-secondary: #A0A0A0    /* Secondary text */
--text-muted: #808080        /* Muted text, hints */

/* Borders & Dividers */
--border-light: rgba(255, 255, 255, 0.1)
--border-dark: rgba(0, 0, 0, 0.3)
```

### RPE Colors (Semantic Gradient)

```css
/* RPE 6-7: Light & Controlled */
--rpe-light: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%);

/* RPE 8-9: Moderate & Engaged */
--rpe-moderate: linear-gradient(135deg, #00FFFF 0%, #00D9D9 100%);

/* RPE 10: Hard & Intense */
--rpe-hard: linear-gradient(135deg, #FF3B30 0%, #FF6B5B 100%);
```

### Glassmorphism Pattern

```css
.glass {
  background: rgba(28, 28, 30, 0.8);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.glass:hover {
  background: rgba(28, 28, 30, 0.9);
  box-shadow: 
    0 12px 48px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}
```

---

## 📐 SYSTÈME DE GRILLE & ESPACEMENT

### Breakpoints Mobile-First

```css
/* Default: Mobile (< 480px) */
--container-padding: 16px;
--grid-cols: 1;

/* Small Devices (480px) */
@media (min-width: 480px) {
  --container-padding: 16px;
  --grid-cols: 2;
}

/* Tablets (768px) */
@media (min-width: 768px) {
  --container-padding: 24px;
  --grid-cols: 3;
}

/* Desktop (1200px) */
@media (min-width: 1200px) {
  --container-padding: 32px;
  --grid-cols: 4;
}
```

### Typography Scale

```
H1: 36px / 700 weight / 1.2 line-height
H2: 28px / 600 weight / 1.3 line-height
H3: 20px / 600 weight / 1.4 line-height
Body: 14px / 400 weight / 1.6 line-height
Label: 12px / 500 weight / 1.5 line-height (uppercase)
Number: 32px / 700 weight (pour poids/reps)
```

### Spacing Scale (8px base)

```
--space-2xs: 4px
--space-xs: 8px
--space-sm: 12px
--space-md: 16px
--space-lg: 24px
--space-xl: 32px
--space-2xl: 48px
```

---

## 🎬 MICRO-INTERACTIONS

### Standard Transitions

```css
button, .interactive {
  transition: all 0.2s ease-in-out;
}

input, textarea {
  transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
}

card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
```

### Hover/Focus States

```css
/* Buttons */
button:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(204, 255, 0, 0.3);
}

button:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Inputs */
input:focus {
  box-shadow: 0 0 0 3px rgba(204, 255, 0, 0.2);
  border-color: var(--accent-primary);
}

/* Cards */
card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
}
```

### Animations Entry

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
animation: fadeIn 0.3s ease-out;

@keyframes slideUp {
  from { 
    transform: translateY(16px); 
    opacity: 0; 
  }
  to { 
    transform: translateY(0); 
    opacity: 1; 
  }
}
animation: slideUp 0.3s ease-out;

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## ✅ CHECKLIST D'IMPLÉMENTATION

### Phase 1: Foundation
- [ ] Créer BottomNavigation.jsx component
- [ ] Créer BottomNavigation.css
- [ ] Modifier App.jsx (layout flex + bottom nav)
- [ ] Modifier App.css (app-content padding-bottom)
- [ ] Tester responsive + safe-area

### Phase 2: SessionRunner
- [ ] Créer WorkoutInputPanel.jsx
- [ ] Créer ExerciseWorkoutCard.jsx
- [ ] Modifier SessionRunner.jsx HTML
- [ ] Refactor SessionRunner.css (inputs 48px+)
- [ ] Tester inputs touch experience

### Phase 3: HomePage
- [ ] Créer StatsSection.jsx
- [ ] Créer RecentSessionsCarousel.jsx
- [ ] Modifier HomePage.jsx layout
- [ ] Refactor HomePage.css

### Phase 4: MusculationPage
- [ ] Créer ExercisesDashboard.jsx
- [ ] Créer SessionsDashboard.jsx
- [ ] Refactor MusculationPage.jsx
- [ ] Update MusculationPage.css

### Phase 5: Polish
- [ ] Micro-animations sur transitions
- [ ] SVG icons
- [ ] Breakpoints verification
- [ ] Accessibility audit
- [ ] npm run build + test

---

*Architecture créée: 24 Mars 2026*
*Ready for implementation* ✅
