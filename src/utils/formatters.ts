/**
 * Format a number as Euro currency using European number formatting standards
 * (narrow no-break space as thousand separator, comma as decimal separator)
 * @param value The numeric value to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted string with € symbol (e.g., "€325 140,41")
 * @example
 * formatEuro(325140.41) // Returns "€325 140,41"
 * formatEuro(1234567.89) // Returns "€1 234 567,89"
 */
export function formatEuro(value: number, decimals: number = 2): string {
  return `€${formatNumber(value, decimals)}`;
}

/**
 * Format a number using European number formatting standards
 * (narrow no-break space as thousand separator, comma as decimal separator)
 * @param value The numeric value to format
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted number string (e.g., "325 140,41")
 * @example
 * formatNumber(325140.41) // Returns "325 140,41"
 * formatNumber(1234.5, 1) // Returns "1 234,5"
 */
export function formatNumber(value: number, decimals: number = 2): string {
  // Use French locale (fr-FR) which uses narrow no-break space (U+202F) as thousand separator
  // and comma as decimal separator, conforming to European/French number formatting standards
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
