/** « 0 séance », « 1 séance », « 2 séances » : le singulier jusqu'à 1 (usage français). */
export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${String(n)} ${Math.abs(n) <= 1 ? one : many}`;
}
