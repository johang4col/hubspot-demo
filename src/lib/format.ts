const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return formatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(isoDate?: string): string {
  return isoDate ? new Date(isoDate).toLocaleString("en-US") : "";
}
