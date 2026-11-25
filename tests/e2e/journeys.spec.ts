import { BENCH, SEED_SESSION, expect, openRecordsOf, readPendingQueue, recordRow, seedMockDb, test, todayCard } from './fixtures';

/** Valide la série en cours (reps, kg, RPE) dans l'écran de séance. */
async function fillSerie(page: import('@playwright/test').Page, reps: string, kg: string, rpe: string) {
  await page.getByRole('textbox', { name: 'Reps' }).fill(reps);
  await page.getByRole('textbox', { name: 'Poids (kg)' }).fill(kg);
  await page.getByRole('radiogroup', { name: 'RPE' }).getByRole('radio', { name: rpe, exact: true }).click();
  await page.getByRole('button', { name: 'Valider la série' }).click();
}

test('1. séance A1 : cible choisie dans « Mes records », arrêt à 2 séries, compte rendu avec PR', async ({ freshPage: page }) => {
  const start = todayCard(page);
  await expect(start).toContainText('Cycle A');
  await start.click();

  await expect(page).toHaveURL(/\/workout$/);
  await expect(page.getByRole('heading', { name: BENCH, level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Mes records' }).click();
  const sheet = page.getByRole('dialog', { name: 'Mes records' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /^6 reps : 92,5 kg/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText('Cible : battre 6 × 92,5 kg')).toBeVisible();

  await fillSerie(page, '6', '95', '9');
  await fillSerie(page, '6', '95', '9');
  await expect(page.getByRole('list', { name: 'Séries faites' }).getByRole('listitem')).toHaveCount(2);

  await page.getByRole('button', { name: 'Fatigué ? Arrêter à 2 séries' }).click();
  await expect(page.getByRole('heading', { name: 'Squat', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Terminer', exact: true }).click();
  const confirm = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await confirm.getByRole('button', { name: 'Terminer', exact: true }).click();

  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByRole('heading', { name: 'Séance terminée' })).toBeVisible();
  await expect(page.getByText(SEED_SESSION)).toBeVisible();
  const series = page.getByRole('list', { name: `Séries — ${BENCH}` });
  await expect(series.getByRole('listitem')).toHaveCount(2);
  await expect(series.getByRole('listitem').first()).toContainText(/Record personnel/);
});

test('2. PR hors séance daté d’hier : visible dans le tableau Records', async ({ freshPage: page }) => {
  await page.goto('/records/add');
  await expect(page.getByRole('heading', { name: 'Ajouter un PR' })).toBeVisible();
  await page.getByRole('button', { name: /^Exercice : / }).click();
  await page.getByRole('radio', { name: BENCH, exact: true }).click();

  await page.getByRole('textbox', { name: 'Reps' }).fill('3');
  await page.getByRole('textbox', { name: 'Kg' }).fill('100');
  await page.getByRole('textbox', { name: 'RPE' }).fill('9');
  await page.getByRole('radiogroup', { name: 'Date du PR' }).getByRole('radio', { name: 'Hier' }).click();
  await expect(page.getByRole('status').filter({ hasText: /record à 3 reps/ })).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer le PR' }).click();

  await expect(page).toHaveURL(/\/records\//);
  const yesterday = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const row = recordRow(page, 3);
  await expect(row).toContainText('100 kg');
  await expect(row).toContainText(yesterday);
});

test('3. cycle prolongé à 3 semaines : bascule annoncée dans 11 jours', async ({ freshPage: page }) => {
  // Horloge figée au 24/11/2026 (fixture) ; cycle A commencé il y a 10 jours (2 semaines) : bascule dans 4 jours.
  await seedMockDb(page, { cycleState: { current: 'A', startedOn: '2026-11-14', lengthDays: 14, extraDays: 0 } });
  const cycle = page.getByRole('region', { name: 'Cycle en cours' });
  await expect(cycle).toContainText('Bascule vers B');
  await expect(cycle).toContainText('dans 4 jours');

  await page.getByRole('link', { name: 'Programme' }).click();
  await expect(page.getByRole('heading', { name: 'Programme', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Reporter d’une semaine' }).click();
  await expect(page.getByText(/reporté de 1 semaine/)).toBeVisible();

  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(cycle).toContainText('Semaine 2 sur 3');
  await expect(cycle).toContainText('Bascule vers B');
  await expect(cycle).toContainText('dans 11 jours');
});

test('4. variante créée sur la fiche exercice : pastille visible dans Records', async ({ freshPage: page }) => {
  await page.goto('/exercises');
  await page.getByRole('link', { name: /Squat/ }).click();
  await expect(page.getByRole('heading', { name: 'Squat', level: 1 })).toBeVisible();

  await page.getByRole('textbox', { name: 'Nom de la nouvelle variante' }).fill('Box squat');
  await page.getByRole('button', { name: 'Ajouter la variante' }).click();
  await expect(page.getByText('Variante ajoutée.')).toBeVisible();

  await openRecordsOf(page, 'Squat');
  await expect(page.getByRole('radiogroup', { name: 'Variante' }).getByRole('radio', { name: 'Box squat' })).toBeVisible();
});

test('5. hors ligne au moment de terminer : rien n’est perdu, la séance arrive dans Records', async ({ freshPage: page, context }) => {
  await todayCard(page).click();
  await expect(page.getByRole('heading', { name: BENCH, level: 1 })).toBeVisible();
  await fillSerie(page, '2', '107,5', '10');
  await page.getByRole('button', { name: 'Fatigué ? Arrêter à 1 série' }).click();

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Terminer', exact: true }).click();
  await page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: 'Terminer', exact: true }).click();

  // Rien n'est perdu : le lot part dans la file locale et le compte rendu s'affiche.
  await expect(page.getByText(/Ta séance est gardée sur cet appareil/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Séance terminée' })).toBeVisible();
  expect(await readPendingQueue(page)).toHaveLength(1);

  // Encore hors ligne : pas encore dans Records.
  await page.getByRole('link', { name: /Retour à l.accueil/ }).click();
  await page.getByRole('link', { name: 'Records', exact: true }).click();
  await page.getByRole('button', { name: /^Exercice : / }).click();
  await page.getByRole('radio', { name: BENCH, exact: true }).click();
  await expect(recordRow(page, 2)).toContainText('à conquérir');

  // Retour du réseau : la file est rejouée et la série apparaît.
  await context.setOffline(false);
  await expect(recordRow(page, 2)).toContainText('107,5 kg');
  expect(await readPendingQueue(page)).toBeNull();
});
