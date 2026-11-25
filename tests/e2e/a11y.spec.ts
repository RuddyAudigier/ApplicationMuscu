import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test, todayCard } from './fixtures';

/**
 * 0 violation d'impact serious ou critical, jeu de règles par défaut d'axe
 * (WCAG 2.x A/AA dont label-content-name-mismatch, + bonnes pratiques).
 */
async function expectNoSeriousViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${String(v.impact)}) : ${v.nodes.map((n) => n.html.slice(0, 300)).join(' | ')}`);
  expect(serious).toEqual([]);
}

const STATIC_ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: '/', heading: 'Accueil' },
  { path: '/program', heading: 'Programme' },
  { path: '/records', heading: 'Records' },
  { path: '/records/add', heading: 'Ajouter un PR' },
  { path: '/exercises', heading: /Exercices/ },
  { path: '/settings', heading: /Réglages/ },
];

for (const { path, heading } of STATIC_ROUTES) {
  test(`axe ${path}`, async ({ freshPage: page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeAttached();
    await page.waitForLoadState('networkidle');
    await expectNoSeriousViolations(page);
  });
}

test('axe /exercises/:id', async ({ freshPage: page }) => {
  await page.goto('/exercises');
  await page.getByRole('link', { name: /Squat/ }).click();
  await expect(page).toHaveURL(/\/exercises\/[^/]+$/);
  await expect(page.getByRole('heading', { name: 'Squat', level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('axe /workout puis /report', async ({ freshPage: page }) => {
  await todayCard(page).click();
  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole('button', { name: 'Valider la série' })).toBeVisible();
  await expectNoSeriousViolations(page);

  // Accueil avec la carte « Reprendre » de la séance en cours.
  await page.goto('/');
  await page.getByRole('link', { name: /^Reprendre Séance en cours/ }).click();
  await expect(page).toHaveURL(/\/workout$/);
  await page.goBack();
  await expect(page.getByRole('link', { name: /^Reprendre Séance en cours/ })).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.goForward();

  await page.getByRole('textbox', { name: 'Reps' }).fill('5');
  await page.getByRole('textbox', { name: 'Poids (kg)' }).fill('80');
  await page.getByRole('button', { name: 'Valider la série' }).click();
  await page.getByRole('button', { name: 'Terminer', exact: true }).click();
  await page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: 'Terminer', exact: true }).click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByRole('heading', { name: 'Séance terminée' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('axe /report sans séance', async ({ freshPage: page }) => {
  await page.goto('/report');
  await expect(page.getByRole('heading', { name: 'Compte rendu', level: 1 })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('axe sheet « Mes records » en séance', async ({ freshPage: page }) => {
  await todayCard(page).click();
  await expect(page).toHaveURL(/\/workout$/);
  await page.getByRole('button', { name: 'Mes records' }).click();
  await expect(page.getByRole('dialog', { name: 'Mes records' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('axe sheet de variante sur la fiche exercice', async ({ freshPage: page }) => {
  await page.goto('/exercises');
  await page.getByRole('link', { name: /Squat/ }).click();
  await expect(page.getByRole('heading', { name: 'Squat', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: /Gérer la variante$/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('axe /records/add avec la date « Autre »', async ({ freshPage: page }) => {
  await page.goto('/records/add');
  await expect(page.getByRole('heading', { name: 'Ajouter un PR', level: 1 })).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Date du PR' }).getByRole('radio', { name: 'Autre' }).click();
  await expect(page.getByLabel('Choisir la date')).toBeVisible();
  await expectNoSeriousViolations(page);
});
