/**
 * Encoding Helpers
 * Utilities for fixing Portuguese character encoding issues
 */

/**
 * Fixes common Portuguese character encoding issues
 * Converts malformed UTF-8 sequences back to correct characters
 *
 * @param text - The text with potentially malformed encoding
 * @returns Fixed text with correct Portuguese characters
 */
export function fixEncoding(text: string | null | undefined): string {
  if (!text) return '';

  return text
    .replace(/Ã£/g, 'ã')
    .replace(/Ã§/g, 'ç')
    .replace(/Ãµ/g, 'õ')
    .replace(/Ã©/g, 'é')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã­/g, 'í')
    .replace(/Ã¡/g, 'á')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã /g, 'à')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ã‰/g, 'É')
    .replace(/Ãƒ/g, 'Ã')
    .replace(/Ã"/g, 'Ó')
    .replace(/Ãš/g, 'Ú');
}

/**
 * Fixes encoding for an array of strings
 *
 * @param texts - Array of strings to fix
 * @returns Array with fixed encoding
 */
export function fixEncodingArray(texts: (string | null | undefined)[]): string[] {
  return texts.map(fixEncoding);
}

/**
 * Fixes encoding for object property values
 * Recursively processes string values in objects
 *
 * @param obj - Object with potentially malformed string values
 * @returns Object with fixed encoding
 */
export function fixEncodingInObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;

  const fixed: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    const value = obj[key];

    if (typeof value === 'string') {
      fixed[key] = fixEncoding(value);
    } else if (typeof value === 'object' && value !== null) {
      fixed[key] = fixEncodingInObject(value);
    } else {
      fixed[key] = value;
    }
  }

  return fixed as T;
}
