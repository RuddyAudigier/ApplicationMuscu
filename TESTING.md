# Tests Unitaires et Couverture de Code

Ce projet utilise **Vitest** pour les tests unitaires avec une couverture de code complète.

## Setup

```bash
npm install --legacy-peer-deps
```

## Exécuter les Tests

### Mode Normal
```bash
npm run test
```

### Mode Watch (reload automatique)
```bash
npm run test:watch
```

### Mode UI (interface visuelle)
```bash
npm run test:ui
```

### Rapport de Couverture
```bash
npm run test:coverage
```

La couverture est générée dans `coverage/` avec un rapport HTML.

## Structure des Tests

```
tests/
├── formatters.test.js          # Tests des formatters (DateFormatter, NumberFormatter, NameNormalizer)
├── performanceAnalysis.test.js # Tests de l'analyse des performances
├── sessionUtils.test.js        # Tests de construction de séances
├── variants.test.js            # Tests de normalisation des variantes
├── muscleGroups.test.js        # Tests de normalisation des groupes musculaires
├── mockService.test.js         # Tests des services mock
└── setup.js                    # Configuration globale
```

## Couverture de Code Actuelle

| Fichier | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| formatters.js | 98% | 96% | 100% | 98% |
| performanceAnalysis.js | 99% | 94% | 100% | 99% |
| sessionUtils.js | 100% | 90% | 100% | 100% |
| muscleGroups.js | 100% | 100% | 100% | 100% |
| variants.js | 100% | 96% | 100% | 100% |
| mockService.js | 84% | 58% | 82% | 84% |
| **TOTAL** | **90%** | **77%** | **89%** | **90%** |

## Principes SOLID et DRY

Les tests respectent les principes suivants :

### Single Responsibility Principle (SRP)
- Chaque module a une responsabilité unique
- `DateFormatter` : conversions de dates
- `NumberFormatter` : conversions de nombres
- `NameNormalizer` : normalisation de noms
- `PerformanceExtractor` : extraction de données
- `PerformanceAnalyzer` : analyse de performances

### DRY (Don't Repeat Yourself)
- Les utilitaires réutilisables sont centralisés dans `src/utils/`
- Les tests utilisent les mêmes fonctions que l'application
- Pas de duplication de logique métier

### Interface Segregation Principle (ISP)
- Les services sont divisés par domaine
- `exercisesService`, `sessionsService`, `performancesService`, etc.
- Les tests peuvent importer uniquement ce dont ils ont besoin

## Écrire de Nouveaux Tests

### Template de test
```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup avant chaque test
  })

  afterEach(() => {
    // Cleanup après chaque test
  })

  it('should do something', () => {
    // Arrange
    const input = 'value'

    // Act
    const result = processInput(input)

    // Assert
    expect(result).toBe('expected')
  })
})
```

## Mutations Testing (Optionnel)

Pour ajouter mutation testing ultérieurement :
```bash
npm install --legacy-peer-deps @stryker-mutator/core @stryker-mutator/vitest
npm run test:mutation
```

## Performance

Les tests s'exécutent rapidement :
- Configuration Vitest optimisée pour jsdom
- Tests en parallèle (4 runners concurrents max)
- Cache Vite activé pour les builds suivants

## Dépannage

### "ReferenceError: __vite_ssr_exportName__ is not defined"
→ Vérifiez que vous avez la version stable de Vite (^5.x)

### Tests qui échouent après modification
→ Assurez-vous d'exécuter `npm install` après changements de dépendances

### Coverage qui ne s'affiche pas
→ Suprimez `coverage/` et `node_modules/.vitest/` et relancez

## Continuité

Pour maintenir 90%+ de couverture :
1. Écrivez les tests AVANT le code (TDD)
2. Utilisez `npm run test:watch` pendant le développement
3. Exécutez `npm run test:coverage` avant chaque commit
4. Maintenez la couverture >= 80%

---

**Dernière mise à jour :** 24 mars 2026
