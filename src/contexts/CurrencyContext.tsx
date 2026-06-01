import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOptionalAuth } from "@/contexts/AuthContext";
import {
  CurrencyCode,
  CurrencyInfo,
  CURRENCIES,
  formatCurrency as formatCurrencyUtil,
  convertAmount,
} from "@/lib/currency";

interface ExchangeRate {
  target_currency: string;
  rate: number;
}

interface CurrencyContextType {
  currency: CurrencyCode;
  currencyInfo: CurrencyInfo;
  rates: Record<string, number>;
  isLoading: boolean;
  setCurrency: (code: CurrencyCode) => Promise<void>;
  formatAmount: (amountInUSD: number, options?: { showSymbol?: boolean; compact?: boolean }) => string;
  formatDual: (amountInUSD: number) => { primary: string; secondary: string };
  convert: (amountInUSD: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const authContext = useOptionalAuth();
  const user = authContext?.user ?? null;
  const profile = authContext?.profile ?? null;
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch exchange rates
  useEffect(() => {
    const fetchRates = async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("target_currency, rate");

      if (!error && data) {
        const ratesMap: Record<string, number> = {};
        data.forEach((r: ExchangeRate) => {
          ratesMap[r.target_currency] = r.rate;
        });
        setRates(ratesMap);
      }
      setIsLoading(false);
    };

    fetchRates();
  }, []);

  // Sync with profile preference
  useEffect(() => {
    if (profile?.preferred_currency) {
      const prefCurrency = profile.preferred_currency as CurrencyCode;
      if (CURRENCIES[prefCurrency]) {
        setCurrencyState(prefCurrency);
      }
    }
  }, [profile?.preferred_currency]);

  const setCurrency = async (code: CurrencyCode) => {
    setCurrencyState(code);

    // Persist to profile if logged in
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_currency: code })
        .eq("id", user.id);
    }
  };

  const convert = useCallback(
    (amountInUSD: number): number => {
      const rate = rates[currency] || 1;
      return convertAmount(amountInUSD, 1, rate);
    },
    [currency, rates]
  );

  const formatAmount = useCallback(
    (amountInUSD: number, options?: { showSymbol?: boolean; compact?: boolean }): string => {
      const converted = convert(amountInUSD);
      return formatCurrencyUtil(converted, currency, options);
    },
    [convert, currency]
  );

  const formatDual = useCallback(
    (amountInUSD: number): { primary: string; secondary: string } => {
      const converted = convert(amountInUSD);
      return {
        primary: formatCurrencyUtil(converted, currency),
        secondary: currency !== "USD" ? formatCurrencyUtil(amountInUSD, "USD") : "",
      };
    },
    [convert, currency]
  );

  const currencyInfo = CURRENCIES[currency];

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyInfo,
        rates,
        isLoading,
        setCurrency,
        formatAmount,
        formatDual,
        convert,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};
