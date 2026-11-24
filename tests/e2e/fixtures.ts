import { expect, test as base, type Page } from '@playwright/test';

/**
 * Clés localStorage lues ou écrites par les e2e : à modifier ici seulement.
 * La partie A renomme la file mock en `mock:pending_performances_queue_v1`.
 */
export const STORAGE_KEYS = {
  mockDb: 'local_test_db_v2',
  pendingQueue: 'pending_performances_queue_v1',
} as const;

/** « Maintenant » figé pour tous les e2e (mardi, heure de Paris) : dates et cycles déterministes. */
export const FIXED_NOW = new Date('2026-11-24T10:00:00+01:00');

/**
 * Chaque test part d'un localStorage vide (base mock re-seedée au premier chargement), avec une
 * horloge figée posée avant le premier `goto`. `setFixedTime` fige `Date` sans geler les timers.
 */
export const test = base.extend<{ freshPage: Page }>({
  freshPage: async ({ page }, provide) => {
    await page.clock.setFixedTime(FIXED_NOW);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await provide(page);
  },
});

export { expect };

/** Exercice du seed mock qui a deux variantes (« Normal » et « Pause »). */
export const BENCH = 'Développé couché';
export const SEED_SESSION = 'Séance test (mock)';

/** Carte « Séance du jour » de l'accueil (nom accessible = texte visible : action, code A1, nom). */
export function todayCard(page: Page) {
  return page.getByRole('button', { name: /^Démarrer Séance du jour · Cycle A Séance test \(mock\)/ });
}

/** Ouvre la fiche Records d'un exercice via le sélecteur d'exercice. */
export async function openRecordsOf(page: Page, exercise: string): Promise<void> {
  await page.goto('/records');
  await expect(page.getByRole('heading', { name: 'Records', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /^Exercice : / }).click();
  await page.getByRole('radio', { name: exercise, exact: true }).click();
  await expect(page.getByRole('button', { name: `Exercice : ${exercise}. Changer d’exercice` })).toBeVisible();
}

/** Ligne du tableau Records pour `reps` répétitions. */
export function recordRow(page: Page, reps: number) {
  return page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: String(reps), exact: true }) });
}

/** Modifie la base mock stockée (créée par le seed au premier chargement), puis recharge la page. */
export async function seedMockDb(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    ({ key, patch: changes }) => {
      const db = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      localStorage.setItem(key, JSON.stringify({ ...db, ...changes }));
    },
    { key: STORAGE_KEYS.mockDb, patch },
  );
  await page.reload();
}

/** Lots de la file hors-ligne ; `null` si la clé est absente. */
export async function readPendingQueue(page: Page): Promise<unknown[] | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown[]);
  }, STORAGE_KEYS.pendingQueue);
}
