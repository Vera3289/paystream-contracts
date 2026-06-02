// SPDX-License-Identifier: Apache-2.0
import { useEffect, useMemo, useState, useCallback } from "react";
import { USDC } from "./config";

export type FiatCurrency = "usd" | "eur" | "gbp";

export interface TokenPricingMetadata {
  symbol: string;
  coingeckoId: string;
  label: string;
}

export const KNOWN_TOKEN_PRICES: Record<string, TokenPricingMetadata> = {
  [USDC.testnet]: {
    symbol: "USDC",
    coingeckoId: "usd-coin",
    label: "USD Coin",
  },
  [USDC.mainnet]: {
    symbol: "USDC",
    coingeckoId: "usd-coin",
    label: "USD Coin",
  },
};

export const AVAILABLE_FIAT_CURRENCIES: Array<{ code: FiatCurrency; label: string }> = [
  { code: "usd", label: "USD" },
  { code: "eur", label: "EUR" },
  { code: "gbp", label: "GBP" },
];

const STORAGE_KEY = "paystream-fiat-currency";
const PRICE_REFRESH_MS = 60_000;

export function getTokenPricingMetadata(token: string): TokenPricingMetadata | undefined {
  return KNOWN_TOKEN_PRICES[token];
}

export function getCurrencySymbol(currency: FiatCurrency): string {
  if (currency === "usd") return "$";
  if (currency === "eur") return "€";
  if (currency === "gbp") return "£";
  return "";
}

export function useFiatPrices() {
  const [fiatCurrency, setFiatCurrency] = useState<FiatCurrency>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "eur" || stored === "gbp" || stored === "usd") return stored;
    return "usd";
  });

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const tokenIds = useMemo(
    () => Array.from(new Set(Object.values(KNOWN_TOKEN_PRICES).map((m) => m.coingeckoId))),
    []
  );

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ids = tokenIds.join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
          ids
        )}&vs_currencies=${encodeURIComponent(fiatCurrency)}`
      );
      if (!res.ok) {
        throw new Error(`CoinGecko responded with ${res.status}`);
      }
      const data = (await res.json()) as Record<string, Record<string, number>>;
      const nextPrices: Record<string, number> = {};
      for (const id of tokenIds) {
        nextPrices[id] = data[id]?.[fiatCurrency] ?? 0;
      }
      setPrices(nextPrices);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [fiatCurrency, tokenIds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, fiatCurrency);
  }, [fiatCurrency]);

  useEffect(() => {
    fetchPrices();
    const interval = window.setInterval(fetchPrices, PRICE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [fetchPrices]);

  const getPriceForToken = useCallback(
    (token: string) => {
      const meta = getTokenPricingMetadata(token);
      if (!meta) return undefined;
      return prices[meta.coingeckoId];
    },
    [prices]
  );

  return {
    fiatCurrency,
    setFiatCurrency,
    prices,
    getPriceForToken,
    loading,
    error,
    lastUpdated,
  };
}
