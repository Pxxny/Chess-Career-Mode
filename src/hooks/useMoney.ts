import { usePreferences } from "@/store/preferences";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

export const BAHT_PER_DOLLAR = 35;

const formatters = {
  USD: (amount: number) => usd.format(amount),
  THB: (amount: number) => thb.format(amount * BAHT_PER_DOLLAR),
};

export function useMoney() {
  return usePreferences(state => formatters[state.currency] ?? formatters.USD);
}
