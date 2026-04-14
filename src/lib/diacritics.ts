/**
 * Folds diacritics and Turkish-specific letters for accent-insensitive search.
 *
 * NFKD decomposes most accented letters ("é" → "e" + combining acute), which we
 * strip with the combining-marks range. Turkish "ı" and "İ" do not decompose,
 * so they are handled explicitly. Result is lowercased ASCII for letters that
 * have ASCII equivalents.
 */
export function foldDiacritics(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .toLowerCase();
}
