import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCIES, CurrencyCode } from "@/lib/currency";

const CurrencySelector = () => {
  const { currency, currencyInfo, setCurrency, rates } = useCurrency();

  const currencyList = Object.values(CURRENCIES);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 px-3 font-mono text-sm hover:bg-secondary"
        >
          <span className="text-base">{currencyInfo.flag}</span>
          <span>{currency}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Select Currency
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currencyList.map((curr) => {
          const rate = rates[curr.code] || 1;
          const isActive = currency === curr.code;

          return (
            <DropdownMenuItem
              key={curr.code}
              onClick={() => setCurrency(curr.code as CurrencyCode)}
              className={`flex items-center justify-between gap-3 cursor-pointer ${
                isActive ? "bg-secondary" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{curr.flag}</span>
                <div className="flex flex-col">
                  <span className="font-medium">{curr.code}</span>
                  <span className="text-xs text-muted-foreground">{curr.name}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs text-muted-foreground">
                  {curr.symbol}
                  {rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CurrencySelector;
