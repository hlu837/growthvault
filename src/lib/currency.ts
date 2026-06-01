export type CurrencyCode = "USD" | "NGN" | "GBP" | "EUR" | "CAD" | "GHS" | "KES" | "ZAR";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  locale: string;
  decimals: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    flag: "🇺🇸",
    locale: "en-US",
    decimals: 2,
  },
  NGN: {
    code: "NGN",
    symbol: "₦",
    name: "Nigerian Naira",
    flag: "🇳🇬",
    locale: "en-NG",
    decimals: 2,
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    flag: "🇬🇧",
    locale: "en-GB",
    decimals: 2,
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    flag: "🇪🇺",
    locale: "de-DE",
    decimals: 2,
  },
  CAD: {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    flag: "🇨🇦",
    locale: "en-CA",
    decimals: 2,
  },
  GHS: {
    code: "GHS",
    symbol: "₵",
    name: "Ghanaian Cedi",
    flag: "🇬🇭",
    locale: "en-GH",
    decimals: 2,
  },
  KES: {
    code: "KES",
    symbol: "KSh",
    name: "Kenyan Shilling",
    flag: "🇰🇪",
    locale: "en-KE",
    decimals: 2,
  },
  ZAR: {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand",
    flag: "🇿🇦",
    locale: "en-ZA",
    decimals: 2,
  },
};

export const formatCurrency = (
  amount: number,
  currencyCode: CurrencyCode,
  options?: { showSymbol?: boolean; compact?: boolean }
): string => {
  const currency = CURRENCIES[currencyCode];
  const { showSymbol = true, compact = false } = options || {};

  const formatter = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
    notation: compact && amount >= 1000000 ? "compact" : "standard",
  });

  const formatted = formatter.format(amount);
  return showSymbol ? `${currency.symbol}${formatted}` : formatted;
};

export const convertAmount = (
  amount: number,
  fromRate: number,
  toRate: number
): number => {
  // Convert to USD first (base), then to target currency
  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
};
