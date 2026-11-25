import { normalizeHeader } from '@/domain/names';

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

/** Numéro de série Excel (jours depuis le 1899-12-30) → date ISO, en UTC. */
function excelSerialToIso(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Lit la première feuille d'un .xlsx en lignes de texte (lignes vides ignorées).
 * La bibliothèque est chargée à la demande pour ne pas alourdir le bundle principal.
 */
export async function readXlsxRows(file: File): Promise<string[][]> {
  const { default: readXlsxFile } = await import('read-excel-file');
  const raw: unknown[][] = await readXlsxFile(file);
  const rows = raw.map((row) => row.map(cellToString)).filter((row) => row.some((c) => c !== ''));
  const dateCol = (rows[0] ?? []).map(normalizeHeader).findIndex((h) => h === 'performance_date' || h === 'date');
  if (dateCol < 0) return rows;
  return rows.map((row, i) => {
    const cell = row[dateCol];
    if (i === 0 || cell === undefined || !/^\d+$/.test(cell)) return row;
    const serial = Number(cell);
    if (serial < 20000 || serial > 80000) return row;
    const copy = [...row];
    copy[dateCol] = excelSerialToIso(serial);
    return copy;
  });
}
