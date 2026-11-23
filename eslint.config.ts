import js from '@eslint/js';
import { existsSync, readdirSync } from 'node:fs';
import globals from 'globals';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import type { Linter } from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Le plugin n'embarque pas de types.
const jsxA11y = jsxA11yPlugin as unknown as { flatConfigs: { recommended: Linter.Config } };

const restrict = (group: string[], message: string): Linter.RulesRecord => ({
  'no-restricted-imports': ['error', { patterns: [{ group, message }] }],
});

const layers = ['app', 'data', 'domain', 'features', 'platform', 'ui'] as const;
const forbid = (...allowed: (typeof layers)[number][]): string[] =>
  layers
    .filter((l) => !allowed.includes(l))
    .flatMap((l) => [
      `@/${l}`,
      `@/${l}/*`,
      `**/${l}`,
      `**/${l}/*`,
    ]);

// Un feature n'atteint un autre feature que par son index (pas d'import profond).
function featureBlocks(): Linter.Config[] {
  const dir = 'src/features';
  const features = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];
  const base = forbid('domain', 'data', 'ui', 'platform', 'features');
  return [
    { files: ['src/features/**'], rules: restrict(base, 'features n’importe pas app.') },
    ...features.map((f) => ({
      files: [`src/features/${f}/**`],
      rules: restrict(
        [
          ...base,
          ...features
            .filter((g) => g !== f)
            .flatMap((g) => [`@/features/${g}/*`, `**/${g}/*`]),
        ],
        'import profond inter-features interdit : passer par l’index du feature.',
      ),
    })),
  ];
}

export default defineConfig(
  {
    ignores: ['dist', 'coverage', 'legacy/**', 'android/**', 'node_modules/**', 'public/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      jsxA11y.flatConfigs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ['*.config.ts', 'eslint-plugins.d.ts'], defaultProject: 'tsconfig.node.json' },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-alert': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
    },
  },
  {
    files: ['*.config.ts', 'tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/domain/**'],
    rules: restrict(forbid('domain'), 'domain importe uniquement domain.'),
  },
  {
    files: ['src/data/**'],
    rules: restrict(forbid('domain', 'data'), 'data importe uniquement domain.'),
  },
  {
    files: ['src/ui/**'],
    rules: restrict(forbid('ui'), 'ui importe rien d’applicatif.'),
  },
  {
    files: ['src/platform/**'],
    rules: restrict([...forbid('domain', 'platform'), '!@capacitor/*'], 'platform importe uniquement domain.'),
  },
  ...featureBlocks(),
);
