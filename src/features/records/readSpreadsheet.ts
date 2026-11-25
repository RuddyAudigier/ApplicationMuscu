/** Cellule Excel → texte : dates en ISO (aaaa-mm-jj), nombres avec « . » décimal. */
function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) {
    // Dates Excel lues en UTC : on garde le jour du classeur, sans décalage de fuseau.
    return cell.toISOString().slice(0, 10);
  }
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'boolean') return cell ? 'true' : 'false';
  return '';
}

/**
 * Lit la première feuille d'un .xlsx en lignes de texte (lignes vides ignorées).
 * La bibliothèque est chargée à la demande pour ne pas alourdir le bundle principal.
 */
export async function readXlsxRows(file: File): Promise<string[][]> {
  const { default: readXlsxFile } = await import('read-excel-file');
  const raw: unknown[][] = await readXlsxFile(file);
  return raw
    .map((row) => row.map(cellToString))
    .filter((row) => row.some((c) => c !== ''));
}
