import { expect, test as base, type Page } from '@playwright/test';

/** Chaque test part d'un localStorage vide (base mock re-seedée au premier chargement). */
export const test = base.extend<{ freshPage: Page }>({
  freshPage: async ({ page }, provide) => {
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
  return page.getByRole('button', { name: /^Démarrer Séance du jour · A1 Séance test \(mock\)/ });
}

/** Ouvre la fiche Records d'un exercice via le sélecteur d'exercice. */
export async function openRecordsOf(page: Page, exercise: string): Promise<void> {
  await page.goto('/records');
  await expect(page.getByRole('heading', { name: 'Records', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /^Exercice : / }).click();
  await page.getByRole('radio', { name: exercise, exact: true }).click();
  await expect(page.getByRole('button', { name: `Exercice : ${exercise}. Changer d'exercice` })).toBeVisible();
}

/** Ligne du tableau Records pour `reps` répétitions. */
export function recordRow(page: Page, reps: number) {
  return page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: String(reps), exact: true }) });
}
