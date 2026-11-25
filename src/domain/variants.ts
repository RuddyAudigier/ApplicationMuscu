import type { Id, Performance, Variant } from './model';
import { normalizeVariantName } from './names';

export const DEFAULT_VARIANT = 'Touch and Go';

const lower = (s: string): string => s.toLocaleLowerCase('fr-FR');

const defaultVariant = (exerciseId: Id | null): Variant => ({
  id: null, exerciseId, name: DEFAULT_VARIANT, isDefault: true,
});

export function normalizeVariants(list: unknown, exerciseId: Id | null): Variant[] {
  const items: unknown[] = Array.isArray(list) ? list : [];
  const unique = new Map<string, Variant>();
  for (const item of items) {
    const obj = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : null;
    const rawName = typeof item === 'string' ? item : obj?.['name'];
    if (typeof rawName !== 'string') continue;
    const name = rawName.trim();
    if (!name) continue;
    const key = lower(name);
    if (unique.has(key)) continue;
    const id = obj?.['id'];
    const exId = obj?.['exerciseId'];
    unique.set(key, {
      id: typeof id === 'string' && id ? id : null,
      exerciseId: typeof exId === 'string' && exId ? exId : exerciseId,
      name,
      isDefault: Boolean(obj?.['isDefault']),
    });
  }
  const out = Array.from(unique.values());
  if (out.length === 0) return [defaultVariant(exerciseId)];
  let defaultIndex = out.findIndex((v) => v.isDefault);
  if (defaultIndex < 0) {
    defaultIndex = out.findIndex((v) => lower(v.name) === lower(DEFAULT_VARIANT));
    if (defaultIndex < 0) defaultIndex = 0;
  }
  return out.map((v, i) => ({ ...v, isDefault: i === defaultIndex }));
}

export function getDefaultVariant(list: Variant[]): Variant {
  return list.find((v) => v.isDefault) ?? list[0] ?? defaultVariant(null);
}

/**
 * Identité unique perf ↔ variante (tableau des records ET détection de PR) :
 * ids égaux quand les deux en ont un ; sinon nom normalisé (vide = « Touch and Go »).
 * Ainsi une variante recréée sous un ancien nom ne récupère pas les records de l'ancienne.
 */
export function sameVariant(
  p: Pick<Performance, 'variantId' | 'variantName'>,
  v: Pick<Variant, 'id' | 'name'>,
): boolean {
  if (p.variantId && v.id) return p.variantId === v.id;
  return normalizeVariantName(p.variantName) === normalizeVariantName(v.name);
}

export function variantMatches(v: Variant, p: Pick<Performance, 'variantId' | 'variantName'>): boolean {
  return sameVariant(p, v);
}

/** Libellé affiché : la variante par défaut (`'Touch and Go'` en base) s'affiche « Classique ». */
export function variantLabel(name: string): string {
  return normalizeVariantName(name) === normalizeVariantName(DEFAULT_VARIANT) ? 'Classique' : name;
}

export function hasDuplicateVariantNames(list: Variant[]): boolean {
  const seen = new Set<string>();
  for (const v of list) {
    const key = lower(v.name.trim());
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
