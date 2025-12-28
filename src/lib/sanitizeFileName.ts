/**
 * Sanitize filename to remove special characters that cause S3/Supabase storage errors.
 * S3 doesn't allow non-ASCII characters like º, ª, ç, accents, etc.
 */
export function sanitizeFileName(fileName: string): string {
  // Separate extension from name
  const lastDot = fileName.lastIndexOf('.');
  const ext = lastDot > 0 ? fileName.slice(lastDot) : '';
  const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;

  const sanitized = baseName
    // Normalize and remove accents/diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Remove special characters (º, ª, ç, etc.) but keep alphanumeric, dots, hyphens, underscores
    .replace(/[^\w\s.-]/g, '')
    // Replace spaces with underscores
    .replace(/\s+/g, '_')
    // Remove duplicate underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_|_$/g, '');

  // Return sanitized name with original extension
  return sanitized + ext.toLowerCase();
}
