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
 * Format Date to Locale String
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format Date Time
 */
export const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
