/**
 * Currency Formatter
 *
 * Formats a number (in Rupees) to a currency string.
 * Uses Intl.NumberFormat for locale-aware formatting.
 */
export const formatCurrency = (amountInRupees: number): string => {
  if (amountInRupees === null || amountInRupees === undefined || isNaN(amountInRupees)) {
    return '₹ 0.00';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInRupees);
};

/**
 * Format Date to Locale String (IST)
 */
export const formatDate = (dateString: string | number): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
};

/**
 * Format Date Time (IST)
 */
export const formatDateTime = (dateString: string | number): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
};

/**
 * Get Local ISO Date String (YYYY-MM-DD)
 * Prevents UTC day-shifting issues.
 */
export const toLocalDateISO = (date: Date = new Date()): string => {
  // Use Intl to get parts in local timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  return formatter.format(date);
};
