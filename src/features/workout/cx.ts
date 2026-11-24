/** Concatène des classes CSS en ignorant les valeurs falsy. */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');
