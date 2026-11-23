/* Archives append-only en Web Storage : rien n'est jamais écrasé ni perdu. */

/**
 * Ajoute `item` en fin du tableau JSON stocké sous `key`. Une archive illisible est conservée
 * comme première entrée brute. Lève si le stockage refuse (l'appelant ne doit pas continuer).
 */
export function appendToArchive(storage: Storage, key: string, item: unknown): void {
  const raw = storage.getItem(key);
  let list: unknown[] = [];
  if (raw !== null) {
    try {
      const json: unknown = JSON.parse(raw);
      list = Array.isArray(json) ? json : [raw];
    } catch {
      list = [raw];
    }
  }
  storage.setItem(key, JSON.stringify([...list, item]));
}

/** Nombre d'entrées d'une archive, en lecture tolérante (illisible = 1, indisponible = 0). */
export function archiveCount(storage: Storage, key: string): number {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return 0;
  }
  if (raw === null) return 0;
  try {
    const json: unknown = JSON.parse(raw);
    return Array.isArray(json) ? json.length : 1;
  } catch {
    return 1;
  }
}
