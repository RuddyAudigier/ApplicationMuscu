import type { Exercise } from './model';
import { normalizeSearch } from './names';

export const MUSCLE_CATALOG: readonly string[] = [
  'Pecs', 'Trapeze', 'Grand dorsal', 'Bas du dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
  'Abdominaux', 'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Abducteurs', 'Psoas',
];

export function normalizeMuscleGroups(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Map<string, string>();
  for (const g of v as unknown[]) {
    if (typeof g !== 'string') continue;
    const t = g.trim();
    if (!t) continue;
    const k = t.toLocaleLowerCase('fr-FR');
    if (!seen.has(k)) seen.set(k, t);
  }
  return Array.from(seen.values());
}

const ALIASES: readonly (readonly [string, readonly string[]])[] = [
  ['pecs', ['pec', 'pecs', 'pectoraux', 'pectoral', 'chest']],
  ['trapeze', ['trapeze', 'trap', 'traps', 'trapezius']],
  ['grand dorsal', ['grand dorsal', 'dorsal', 'lats', 'latissimus', 'dos']],
  ['bas du dos', ['bas du dos', 'lombaire', 'lombaires', 'lower back']],
  ['epaules', ['epaule', 'epaules', 'deltoide', 'deltoides', 'shoulder']],
  ['biceps', ['biceps']],
  ['triceps', ['triceps']],
  ['avant-bras', ['avant bras', 'avant-bras', 'forearm']],
  ['abdominaux', ['abdo', 'abdos', 'abdominaux', 'abdominal', 'abs', 'core', 'oblique', 'obliques']],
  ['quadriceps', ['quadriceps', 'quad', 'quads']],
  ['ischios', ['ischio', 'ischios', 'ischio-jambiers', 'hamstring', 'hamstrings']],
  ['fessiers', ['fessier', 'fessiers', 'glute', 'glutes', 'gluteal']],
  ['mollets', ['mollet', 'mollets', 'calf', 'calves']],
  ['abducteurs', ['abducteur', 'abducteurs', 'adducteur', 'adducteurs', 'adductors', 'abductors']],
  ['psoas', ['psoas', 'hip flexor', 'iliopsoas']],
];

const squash = (s: string): string => normalizeSearch(s).replace(/\s+/g, ' ');

/** Toutes les clés canoniques dont un alias est contenu dans le texte. */
export function muscleKeys(label: string): string[] {
  const n = squash(label);
  if (!n) return [];
  return ALIASES.filter(([, aliases]) => aliases.some((a) => n.includes(a))).map(([key]) => key);
}

/** Clé canonique : alias exact en priorité (évite Bas du dos vers grand dorsal), sinon premier match contenu. */
export function muscleKey(label: string): string | null {
  const n = squash(label);
  const exact = ALIASES.find(([, aliases]) => aliases.includes(n));
  if (exact) return exact[0];
  return muscleKeys(label)[0] ?? null;
}

export const BODY_SLUGS: Record<string, string[]> = {
  pecs: ['chest'],
  trapeze: ['trapezius'],
  'grand dorsal': ['upper-back'],
  ischios: ['hamstring'],
  quadriceps: ['quadriceps'],
  epaules: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  abdominaux: ['abs', 'obliques'],
  'avant-bras': ['forearm'],
  fessiers: ['gluteal'],
  mollets: ['calves'],
  'bas du dos': ['lower-back'],
  abducteurs: ['adductors'],
};

export function bodySlugsFor(labels: string[]): string[] {
  const out: string[] = [];
  for (const label of labels) {
    const key = muscleKey(label);
    for (const slug of (key ? BODY_SLUGS[key] : undefined) ?? []) {
      if (!out.includes(slug)) out.push(slug);
    }
  }
  return out;
}

const BACK_SLUGS = ['upper-back', 'lower-back', 'hamstring', 'gluteal', 'trapezius'];
const FRONT_SLUGS = ['chest', 'biceps', 'abs', 'obliques', 'quadriceps', 'tibialis'];

export function autoView(slugs: string[]): 'front' | 'back' {
  const back = slugs.some((s) => BACK_SLUGS.includes(s));
  const front = slugs.some((s) => FRONT_SLUGS.includes(s));
  return back && !front ? 'back' : 'front';
}

export function matchesQuery(e: Pick<Exercise, 'name' | 'muscleGroups'>, q: string): boolean {
  const query = squash(q);
  if (!query) return true;
  if (squash(e.name).includes(query)) return true;
  const queryKeys = muscleKeys(query);
  return e.muscleGroups.some((g) => {
    if (squash(g).includes(query)) return true;
    const keys = muscleKeys(g);
    return queryKeys.some((k) => keys.includes(k));
  });
}
