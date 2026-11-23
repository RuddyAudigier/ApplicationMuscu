import { parseDateToIso } from './dates';
import type { Exercise, IsoDate, PerformanceInput } from './model';
import { normalizeHeader, normalizeVariantName } from './names';
import { toNumber } from './numbers';
import { getDefaultVariant, variantMatches } from './variants';

const lines = (text: string): string[] =>
  text.replace(/\r\n?/g, '\n').trim().split('\n').filter((l) => l.trim() !== '');

/** Découpe une ligne : guillemets, `""` échappé, cellules trimées (INV §3.14). */
function parseLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line.charAt(i);
    if (quoted) {
      if (ch === '"' && line.charAt(i + 1) === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** Lignes non vides ; délimiteur `;` si l'en-tête en contient un, sinon `,`. */
export function parseCsv(text: string): string[][] {
  const all = lines(text);
  const delimiter = all[0]?.includes(';') ? ';' : ',';
  return all.map((l) => parseLine(l, delimiter));
}

const ALIASES = {
  id: ['exercise_id', 'exo_id', 'id_exercice'],
  name: ['exercise_name', 'exercise', 'exercice', 'nom_exercice', 'name'],
  reps: ['reps', 'repetitions'],
  weight: ['weight', 'poids', 'kg', 'charge'],
  rpe: ['rpe'],
  variant: ['variant', 'variante', 'variant_name'],
  serie: ['series_number', 'serie_number', 'serie', 'series', 'set'],
  date: ['performance_date', 'date'],
  session: ['session_name', 'session', 'seance'],
} as const;
type Column = keyof typeof ALIASES;

type LineResult = { row: PerformanceInput } | { error: string };

function importLine(
  get: (c: Column) => string,
  line: number,
  exercises: Exercise[],
  today: IsoDate,
): LineResult {
  const fail = (msg: string): LineResult => ({ error: `Ligne ${String(line)}: ${msg}` });
  const id = get('id');
  const name = get('name');
  const exercise =
    (id ? exercises.find((e) => e.id === id) : undefined) ??
    (name ? exercises.find((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase()) : undefined);
  if (!exercise) return fail(`exercice introuvable (${name || id || 'vide'}).`);

  const reps = Number.parseInt(get('reps'), 10);
  if (Number.isNaN(reps) || reps < 0) return fail('reps invalide.');
  const weightRaw = get('weight');
  const weight = weightRaw === '' ? null : toNumber(weightRaw);
  if (weight === null || weight < 0) return fail('poids invalide.');
  const serie = Number.parseInt(get('serie') || '1', 10);
  if (Number.isNaN(serie) || serie <= 0) return fail('numéro de série invalide.');
  const rpeRaw = get('rpe');
  // Parité legacy `parseInt` : « 9,5 » → 9 (comme reps et série).
  const rpeInt = Number.parseInt(rpeRaw, 10);
  const rpe = rpeRaw === '' ? 10 : rpeInt >= 6 && rpeInt <= 10 ? rpeInt : null;
  if (rpe === null) return fail('RPE doit être entre 6 et 10.');
  const dateRaw = get('date');
  const date = dateRaw === '' ? today : parseDateToIso(dateRaw);
  if (date === null) return fail(`date invalide (${dateRaw}).`);
  if (reps === 0) return fail('0 rep, ignorée.');

  const variantRaw = get('variant');
  // Nom normalisé (casse, espaces) ; « Classique » = libellé de la variante par défaut.
  const variant =
    variantRaw === '' || normalizeVariantName(variantRaw) === 'classique'
      ? getDefaultVariant(exercise.variants)
      : exercise.variants.find((v) => variantMatches(v, { variantId: null, variantName: variantRaw }));

  return {
    row: {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sessionName: get('session') || 'Import CSV',
      reps,
      weight,
      rpe,
      variantId: variant ? variant.id : null,
      variantName: variant ? variant.name : variantRaw,
      serieNumber: serie,
      performanceDate: date,
    },
  };
}

/**
 * Import CSV legacy (INV §3.14, messages exacts). Les lignes invalides sont ignorées avec une
 * erreur ; les lignes à 0 rep sont exclues et signalées (D7). `today` = date par défaut.
 */
export function importPerformances(
  text: string,
  exercises: Exercise[],
  today: IsoDate,
): { rows: PerformanceInput[]; errors: string[] } {
  const table = parseCsv(text);
  const [header, ...data] = table;
  if (!header) return { rows: [], errors: ['Le fichier CSV est vide.'] };
  if (data.length === 0) {
    return { rows: [], errors: ["Le CSV doit contenir une ligne d'en-tête et au moins une ligne de données."] };
  }

  const headers = header.map(normalizeHeader);
  const columnIndex = (c: Column): number => headers.findIndex((h) => (ALIASES[c] as readonly string[]).includes(h));
  const indexes = Object.fromEntries(
    (Object.keys(ALIASES) as Column[]).map((c) => [c, columnIndex(c)]),
  ) as Record<Column, number>;

  const rows: PerformanceInput[] = [];
  const errors: string[] = [];
  data.forEach((cells, i) => {
    const get = (c: Column): string => cells[indexes[c]] ?? '';
    const result = importLine(get, i + 2, exercises, today);
    if ('row' in result) rows.push(result.row);
    else errors.push(result.error);
  });
  return { rows, errors };
}
