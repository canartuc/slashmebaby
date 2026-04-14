// Folds diacritics (including Turkish ı/İ) to plain ASCII for search matching.
// NFKD decomposes accented characters, then the combining-mark range is stripped.
// Turkish dotless-i pairs are handled explicitly because they don't decompose.
export function foldDiacritics(input: string): string {
  return input
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
