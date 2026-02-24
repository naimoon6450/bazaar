/**
 * Format a price for display with currency symbol.
 * Safe to import from client components — no server dependencies.
 */
export function formatPrice(price: string, currency: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return price;

  switch (currency) {
    case "INR":
      return `\u20B9${num.toLocaleString("en-IN")}`;
    case "GBP":
      return `\u00A3${num.toFixed(2)}`;
    case "EUR":
      return `\u20AC${num.toFixed(2)}`;
    default:
      return `$${num.toFixed(2)}`;
  }
}
