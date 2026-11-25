import { defineConfig, devices } from '@playwright/test';

const PORT = 5299;

/** e2e en mode mock (backend localStorage), mobile Pixel 7, français, heure de Paris. */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'pixel-7', use: { ...devices['Pixel 7'], locale: 'fr-FR', timezoneId: 'Europe/Paris' } }],
  webServer: {
    command: `npx vite --mode mock --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
